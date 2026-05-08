use std::path::PathBuf;

use crate::database::schema;

use super::DatabaseError;

pub const MIGRATIONS: [Migration; 11] = [
    Migration {
        id: "0001_initial_schema",
        sql: schema::INITIAL_SCHEMA_MIGRATION,
    },
    Migration {
        id: "0002_library_query_indexes",
        sql: schema::LIBRARY_QUERY_INDEXES_MIGRATION,
    },
    Migration {
        id: "0003_flac_track_support",
        sql: schema::FLAC_TRACK_SUPPORT_MIGRATION,
    },
    Migration {
        id: "0004_explicit_advisory_metadata",
        sql: schema::EXPLICIT_ADVISORY_METADATA_MIGRATION,
    },
    Migration {
        id: "0005_local_playlists_foundation",
        sql: schema::LOCAL_PLAYLISTS_FOUNDATION_MIGRATION,
    },
    Migration {
        id: "0006_playlist_artwork",
        sql: schema::PLAYLIST_ARTWORK_MIGRATION,
    },
    Migration {
        id: "0007_concept_albums_foundation",
        sql: schema::CONCEPT_ALBUMS_FOUNDATION_MIGRATION,
    },
    Migration {
        id: "0008_mixtapes_foundation",
        sql: schema::MIXTAPES_FOUNDATION_MIGRATION,
    },
    Migration {
        id: "0009_artist_image_config",
        sql: schema::ARTIST_IMAGE_CONFIG_MIGRATION,
    },
    Migration {
        id: "0010_track_year_and_album_metadata",
        sql: schema::TRACK_YEAR_AND_ALBUM_METADATA_MIGRATION,
    },
    Migration {
        id: "0011_app_settings",
        sql: schema::APP_SETTINGS_MIGRATION,
    },
];

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MigrationStatus {
    pub database_path: PathBuf,
    pub applied_migrations: usize,
    pub latest_migration: &'static str,
}

#[derive(Clone, Copy)]
pub struct Migration {
    pub id: &'static str,
    pub sql: &'static str,
}

// Executes each semicolon-delimited statement individually. For ADD COLUMN statements,
// "duplicate column name" errors are ignored so migrations are idempotent against partial runs.
fn execute_migration_statements(
    transaction: &rusqlite::Transaction,
    sql: &str,
) -> Result<(), DatabaseError> {
    for raw in sql.split(';') {
        let stmt = raw.trim();
        if stmt.is_empty() {
            continue;
        }
        match transaction.execute_batch(stmt) {
            Ok(()) => {}
            Err(rusqlite::Error::SqliteFailure(_, Some(ref msg)))
                if stmt.to_ascii_uppercase().contains("ADD COLUMN")
                    && msg.contains("duplicate column name") =>
            {
                // Column already exists — treat as a no-op.
            }
            Err(e) => return Err(DatabaseError::from(e)),
        }
    }
    Ok(())
}

pub(crate) fn run_migrations(connection: &mut rusqlite::Connection) -> Result<(), DatabaseError> {
    connection.execute_batch(
        "
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL
        );
        ",
    )?;

    for migration in MIGRATIONS {
        let already_applied = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE id = ?1)",
            [migration.id],
            |row| row.get::<_, i64>(0),
        )?;

        if already_applied == 0 {
            let transaction = connection.unchecked_transaction()?;
            execute_migration_statements(&transaction, migration.sql)?;
            transaction.execute(
                "
                INSERT INTO schema_migrations (id, applied_at)
                VALUES (?1, datetime('now'))
                ",
                [migration.id],
            )?;
            transaction.commit()?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{run_migrations, MIGRATIONS};

    #[test]
    fn run_migrations_applies_every_declared_migration() {
        let mut connection = rusqlite::Connection::open_in_memory().expect("db should open");

        run_migrations(&mut connection).expect("migrations should apply");

        let applied_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .expect("migration count should load");

        assert_eq!(applied_count as usize, MIGRATIONS.len());
    }

    #[test]
    fn run_migrations_is_idempotent_for_existing_schema() {
        let mut connection = rusqlite::Connection::open_in_memory().expect("db should open");

        run_migrations(&mut connection).expect("first run should succeed");
        run_migrations(&mut connection).expect("second run should succeed");

        let applied_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .expect("migration count should load");

        assert_eq!(applied_count as usize, MIGRATIONS.len());
    }
}
