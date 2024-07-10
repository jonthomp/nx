use crate::native::machine_id::get_machine_id;
use rusqlite::{params, Connection};
use std::fs::create_dir_all;
use std::path::Path;

pub fn connect_to_nx_db<P>(cache_dir: P) -> anyhow::Result<Connection>
where
    P: AsRef<Path>,
{
    let machine_id = get_machine_id();
    let db_path = cache_dir.as_ref().join(format!("{}.db", machine_id));
    create_dir_all(cache_dir)?;
    let c = Connection::open(db_path).map_err(anyhow::Error::from)?;

    c.pragma_update(None, "journal_mode", &"WAL")?;

    c.execute(
        "
            CREATE TABLE IF NOT EXISTS task_details (
                hash    TEXT PRIMARY KEY NOT NULL,
                project  TEXT NOT NULL,
                target  TEXT NOT NULL,
                configuration  TEXT
            );",
        params![],
    )?;

    Ok(c)
}
