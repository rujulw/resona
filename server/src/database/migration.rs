use std::path::PathBuf;

use crate::database::schema;

use super::DatabaseError;

pub const MIGRATIONS: [Migration; 2] = [
    Migration {
        id: "0001_initial_schema",
        sql: schema::INITIAL_SCHEMA_MIGRATION,
    },
    Migration {
        id: "0002_library_query_indexes",
        sql: schema::LIBRARY_QUERY_INDEXES_MIGRATION,
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
            transaction.execute_batch(migration.sql)?;
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
