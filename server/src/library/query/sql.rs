use super::{SortDirection, TrackSortKey};

pub(crate) fn build_library_query_sql(
    has_search: bool,
    has_cursor: bool,
    sort_key: TrackSortKey,
    sort_direction: SortDirection,
) -> String {
    let sort_expression = match sort_key {
        TrackSortKey::Title => "lower(COALESCE(t.title, ''))",
        TrackSortKey::Artist => "lower(COALESCE(t.artist, ''))",
        TrackSortKey::Album => "lower(COALESCE(t.album, ''))",
        TrackSortKey::IndexedAt => "t.indexed_at",
    };

    let comparison = match sort_direction {
        SortDirection::Asc => ">",
        SortDirection::Desc => "<",
    };

    let direction = match sort_direction {
        SortDirection::Asc => "ASC",
        SortDirection::Desc => "DESC",
    };

    let mut sql = format!(
        "
        SELECT
          t.id,
          t.title,
          t.artist,
          t.album,
          t.advisory,
          t.duration_seconds,
          t.artwork_key,
          t.relative_path,
          t.extension,
          ts.source_status,
          ce.cache_state,
          ar.analysis_status,
          t.indexed_at
        FROM tracks t
        JOIN track_sources ts ON ts.track_id = t.id
        JOIN cache_entries ce ON ce.track_id = t.id
        JOIN analysis_results ar ON ar.track_id = t.id
        WHERE 1 = 1
        "
    );

    if has_search {
        sql.push_str(
            "
            AND (
              lower(t.title) LIKE ?1
              OR lower(COALESCE(t.artist, '')) LIKE ?2
              OR lower(COALESCE(t.album, '')) LIKE ?3
            )
            ",
        );
    }

    if has_cursor {
        let base_index = if has_search { 4 } else { 1 };
        sql.push_str(&format!(
            "
            AND (
              {sort_expression} {comparison} ?{base_index}
              OR ({sort_expression} = ?{base_index_plus_one} AND t.id {comparison} ?{base_index_plus_two})
            )
            ",
            base_index = base_index,
            base_index_plus_one = base_index + 1,
            base_index_plus_two = base_index + 2,
        ));
    }

    let limit_param = if has_search && has_cursor {
        7
    } else if has_search || has_cursor {
        4
    } else {
        1
    };

    sql.push_str(&format!(
        "
        ORDER BY {sort_expression} {direction}, t.id {direction}
        LIMIT ?{limit_param}
        "
    ));

    sql
}
