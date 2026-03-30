pub mod schema;

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;

const APP_DIR_NAME: &str = "resona";
const DATABASE_FILE_NAME: &str = "resona.sqlite3";
const MIGRATIONS: [Migration; 2] = [
    Migration {
        id: "0001_initial_schema",
        sql: schema::INITIAL_SCHEMA_MIGRATION,
    },
    Migration {
        id: "0002_library_query_indexes",
        sql: schema::LIBRARY_QUERY_INDEXES_MIGRATION,
    },
];

#[derive(Clone, Debug)]
pub struct AppDatabase {
    db_path: PathBuf,
}

impl AppDatabase {
    pub fn initialize_default() -> Result<Self, DatabaseError> {
        let base_dir = dirs::data_local_dir().ok_or(DatabaseError::MissingDataDir)?;
        Self::initialize_at(base_dir.join(APP_DIR_NAME).join(DATABASE_FILE_NAME))
    }

    pub fn initialize_at(db_path: impl Into<PathBuf>) -> Result<Self, DatabaseError> {
        let db_path = db_path.into();

        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let database = Self { db_path };
        database.run_migrations()?;

        Ok(database)
    }

    pub fn db_path(&self) -> &Path {
        &self.db_path
    }

    pub fn connect(&self) -> Result<Connection, DatabaseError> {
        let connection = Connection::open(&self.db_path)?;
        connection.execute_batch("PRAGMA foreign_keys = ON;")?;
        Ok(connection)
    }

    pub fn migration_status(&self) -> Result<MigrationStatus, DatabaseError> {
        let connection = self.connect()?;
        let migration_count: i64 =
            connection.query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
                row.get(0)
            })?;

        Ok(MigrationStatus {
            database_path: self.db_path.clone(),
            applied_migrations: migration_count as usize,
            latest_migration: MIGRATIONS
                .last()
                .map(|migration| migration.id)
                .unwrap_or("none"),
        })
    }

    fn run_migrations(&self) -> Result<(), DatabaseError> {
        let connection = self.connect()?;
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
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MigrationStatus {
    pub database_path: PathBuf,
    pub applied_migrations: usize,
    pub latest_migration: &'static str,
}

#[derive(Clone, Copy)]
struct Migration {
    id: &'static str,
    sql: &'static str,
}

#[derive(Debug)]
pub enum DatabaseError {
    MissingDataDir,
    Io(std::io::Error),
    Sqlite(rusqlite::Error),
}

impl std::fmt::Display for DatabaseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MissingDataDir => write!(f, "local data directory is unavailable"),
            Self::Io(error) => write!(f, "{error}"),
            Self::Sqlite(error) => write!(f, "{error}"),
        }
    }
}

impl std::error::Error for DatabaseError {}

impl From<std::io::Error> for DatabaseError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<rusqlite::Error> for DatabaseError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Sqlite(error)
    }
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{AppDatabase, MIGRATIONS};

    fn unique_test_db_path() -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("resona-schema-test-{nanos}.sqlite3"))
    }

    #[test]
    fn initializes_database_and_applies_initial_schema() {
        let db_path = unique_test_db_path();
        let database = AppDatabase::initialize_at(&db_path).expect("database should initialize");

        let status = database
            .migration_status()
            .expect("migration status should load");

        assert_eq!(status.applied_migrations, MIGRATIONS.len());
        assert_eq!(
            status.latest_migration,
            MIGRATIONS.last().expect("migrations should exist").id
        );
        assert_eq!(status.database_path, db_path);
    }

    #[test]
    fn initialization_is_idempotent() {
        let db_path = unique_test_db_path();

        AppDatabase::initialize_at(&db_path).expect("first initialization should succeed");
        let database =
            AppDatabase::initialize_at(&db_path).expect("second initialization should succeed");

        let status = database
            .migration_status()
            .expect("migration status should load");

        assert_eq!(status.applied_migrations, MIGRATIONS.len());
    }
}
