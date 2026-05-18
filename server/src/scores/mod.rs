use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScorePartSummary {
    pub id: String,
    pub name: String,
    pub measure_count: usize,
    pub staff_count: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreNoteEvent {
    pub id: String,
    pub part_id: String,
    pub part_name: String,
    pub measure_number: usize,
    pub staff: usize,
    pub voice: String,
    pub midi: i32,
    pub note_name: String,
    pub start_beats: f64,
    pub duration_beats: f64,
    pub start_seconds: Option<f64>,
    pub duration_seconds: Option<f64>,
    pub is_chord_tone: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreDetailPayload {
    pub source_path: String,
    pub source_name: String,
    pub source_format: String,
    pub title: String,
    pub composer: Option<String>,
    pub tempo_bpm: Option<f64>,
    pub time_signature: Option<String>,
    pub key_signature: Option<String>,
    pub total_beats: f64,
    pub total_seconds: Option<f64>,
    pub part_count: usize,
    pub measure_count: usize,
    pub note_count: usize,
    pub parts: Vec<ScorePartSummary>,
    pub events: Vec<ScoreNoteEvent>,
}

#[derive(Debug)]
pub struct ScoreExtractError(pub String);

impl std::fmt::Display for ScoreExtractError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for ScoreExtractError {}

pub fn extract_score_from_path(source_path: &str) -> Result<ScoreDetailPayload, ScoreExtractError> {
    let path = Path::new(source_path);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();

    if extension != "musicxml" && extension != "xml" && extension != "mxl" {
        return Err(ScoreExtractError(
            "Unsupported score format. Expected a .musicxml, .xml, or .mxl file.".to_owned(),
        ));
    }

    let xml = if extension == "mxl" {
        read_mxl_score(path)?
    } else {
        fs::read_to_string(path).map_err(|error| {
            ScoreExtractError(format!(
                "Failed to read score file at {}: {error}",
                path.display()
            ))
        })?
    };

    let root = parse_xml_document(&xml)?;
    build_score_payload(&root, source_path)
}

fn read_mxl_score(path: &Path) -> Result<String, ScoreExtractError> {
    let file = fs::File::open(path).map_err(|error| {
        ScoreExtractError(format!(
            "Failed to open compressed score at {}: {error}",
            path.display()
        ))
    })?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ScoreExtractError(format!("Failed to read .mxl archive: {error}")))?;

    let container_xml = read_zip_entry(&mut archive, "META-INF/container.xml").map_err(|error| {
        ScoreExtractError(format!(
            "Failed to load META-INF/container.xml from {}: {error}",
            path.display()
        ))
    })?;
    let container_root = parse_xml_document(&container_xml)?;
    let compressed_file_name = resolve_mxl_rootfile_path(&container_root)?;
    read_zip_entry(&mut archive, &compressed_file_name).map_err(|error| {
        ScoreExtractError(format!(
            "Failed to read score file {compressed_file_name} from {}: {error}",
            path.display()
        ))
    })
}

fn read_zip_entry<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    entry_name: &str,
) -> Result<String, ScoreExtractError> {
    let mut file = archive.by_name(entry_name).map_err(|error| {
        ScoreExtractError(format!("Zip entry {entry_name} was not found: {error}"))
    })?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|error| ScoreExtractError(format!("Failed to read zip entry {entry_name}: {error}")))?;

    String::from_utf8(bytes).map_err(|error| {
        ScoreExtractError(format!("Zip entry {entry_name} was not valid UTF-8 XML: {error}"))
    })
}

fn resolve_mxl_rootfile_path(root: &XmlNode) -> Result<String, ScoreExtractError> {
    let container = if root.name == "container" {
        root
    } else {
        root.find_first("container")
            .ok_or_else(|| ScoreExtractError("Invalid .mxl container.xml: missing <container>".to_owned()))?
    };
    let rootfiles = container
        .child("rootfiles")
        .ok_or_else(|| ScoreExtractError("Invalid .mxl container.xml: missing <rootfiles>".to_owned()))?;

    let mut compressed_file_name: Option<String> = None;
    for rootfile in rootfiles.children_named("rootfile") {
        let media_type = rootfile.attrs.get("media-type").map(String::as_str);
        if media_type.is_none() || media_type == Some("application/vnd.recordare.musicxml+xml") {
            let full_path = rootfile
                .attrs
                .get("full-path")
                .cloned()
                .ok_or_else(|| ScoreExtractError("Invalid .mxl container.xml: missing rootfile full-path".to_owned()))?;
            if compressed_file_name.is_some() {
                return Err(ScoreExtractError(
                    "Multiple MusicXML files found in compressed archive".to_owned(),
                ));
            }
            compressed_file_name = Some(full_path);
        }
    }

    compressed_file_name.ok_or_else(|| {
        ScoreExtractError("Unable to locate main .xml file in compressed archive.".to_owned())
    })
}

#[derive(Clone, Debug)]
struct XmlNode {
    name: String,
    attrs: HashMap<String, String>,
    children: Vec<XmlNode>,
    text: String,
}

impl XmlNode {
    fn new(name: String, attrs: HashMap<String, String>) -> Self {
        Self {
            name,
            attrs,
            children: Vec::new(),
            text: String::new(),
        }
    }

    fn child(&self, name: &str) -> Option<&XmlNode> {
        self.children.iter().find(|child| child.name == name)
    }

    fn children_named<'a>(&'a self, name: &'a str) -> impl Iterator<Item = &'a XmlNode> {
        self.children.iter().filter(move |child| child.name == name)
    }

    fn has_child(&self, name: &str) -> bool {
        self.children.iter().any(|child| child.name == name)
    }

    fn child_text(&self, name: &str) -> Option<String> {
        self.child(name).map(|child| child.text.trim().to_owned())
    }

    fn find_first<'a>(&'a self, name: &str) -> Option<&'a XmlNode> {
        if self.name == name {
            return Some(self);
        }

        for child in &self.children {
            if let Some(found) = child.find_first(name) {
                return Some(found);
            }
        }

        None
    }

    fn find_first_with_attr<'a>(
        &'a self,
        name: &str,
        attr_name: &str,
        attr_value: &str,
    ) -> Option<&'a XmlNode> {
        if self.name == name
            && self
                .attrs
                .get(attr_name)
                .is_some_and(|value| value == attr_value)
        {
            return Some(self);
        }

        for child in &self.children {
            if let Some(found) = child.find_first_with_attr(name, attr_name, attr_value) {
                return Some(found);
            }
        }

        None
    }
}

fn parse_xml_document(xml: &str) -> Result<XmlNode, ScoreExtractError> {
    let mut stack = vec![XmlNode::new("document".to_owned(), HashMap::new())];
    let mut cursor = 0usize;

    while cursor < xml.len() {
        let remaining = &xml[cursor..];
        if let Some(stripped) = remaining.strip_prefix("<?") {
            let end = stripped
                .find("?>")
                .ok_or_else(|| ScoreExtractError("Unclosed XML declaration".to_owned()))?;
            cursor += 2 + end + 2;
            continue;
        }

        if let Some(stripped) = remaining.strip_prefix("<!--") {
            let end = stripped
                .find("-->")
                .ok_or_else(|| ScoreExtractError("Unclosed XML comment".to_owned()))?;
            cursor += 4 + end + 3;
            continue;
        }

        if let Some(stripped) = remaining.strip_prefix("<![CDATA[") {
            let end = stripped
                .find("]]>")
                .ok_or_else(|| ScoreExtractError("Unclosed CDATA section".to_owned()))?;
            if let Some(node) = stack.last_mut() {
                node.text.push_str(&stripped[..end]);
            }
            cursor += 9 + end + 3;
            continue;
        }

        if remaining.starts_with("<!DOCTYPE") {
            let end = find_doctype_end(remaining)
                .ok_or_else(|| ScoreExtractError("Unclosed DOCTYPE declaration".to_owned()))?;
            cursor += end;
            continue;
        }

        if remaining.starts_with('<') {
            let close = remaining
                .find('>')
                .ok_or_else(|| ScoreExtractError("Unclosed XML tag".to_owned()))?;
            let inside = &remaining[1..close];
            cursor += close + 1;

            if let Some(end_tag) = inside.strip_prefix('/') {
                let closing_name = end_tag.trim();
                let node = stack
                    .pop()
                    .ok_or_else(|| ScoreExtractError("Unexpected closing tag".to_owned()))?;
                if node.name != closing_name {
                    return Err(ScoreExtractError(format!(
                        "Mismatched XML closing tag: expected </{}> but found </{}>",
                        node.name, closing_name
                    )));
                }
                let parent = stack
                    .last_mut()
                    .ok_or_else(|| ScoreExtractError("Missing XML parent node".to_owned()))?;
                parent.children.push(node);
                continue;
            }

            let self_closing = inside.trim_end().ends_with('/');
            let trimmed = inside.trim_end();
            let tag_content = if self_closing {
                trimmed[..trimmed.len() - 1].trim_end()
            } else {
                inside.trim()
            };

            let (name, attrs) = parse_tag_content(tag_content)?;
            let node = XmlNode::new(name, attrs);

            if self_closing {
                let parent = stack
                    .last_mut()
                    .ok_or_else(|| ScoreExtractError("Missing XML parent node".to_owned()))?;
                parent.children.push(node);
            } else {
                stack.push(node);
            }
            continue;
        }

        let next_tag = remaining.find('<').unwrap_or(remaining.len());
        let text = &remaining[..next_tag];
        if !text.trim().is_empty() {
            if let Some(node) = stack.last_mut() {
                if !node.text.is_empty() {
                    node.text.push(' ');
                }
                node.text.push_str(text.trim());
            }
        }
        cursor += next_tag;
    }

    while stack.len() > 1 {
        let node = stack
            .pop()
            .ok_or_else(|| ScoreExtractError("Malformed XML document".to_owned()))?;
        let parent = stack
            .last_mut()
            .ok_or_else(|| ScoreExtractError("Missing XML parent node".to_owned()))?;
        parent.children.push(node);
    }

    let document = stack
        .pop()
        .ok_or_else(|| ScoreExtractError("Missing XML document root".to_owned()))?;
    document
        .children
        .into_iter()
        .next()
        .ok_or_else(|| ScoreExtractError("Score file did not contain a root element".to_owned()))
}

fn find_doctype_end(input: &str) -> Option<usize> {
    let mut in_quote: Option<char> = None;
    let mut bracket_depth = 0usize;

    for (index, ch) in input.char_indices() {
        if let Some(quote) = in_quote {
            if ch == quote {
                in_quote = None;
            }
            continue;
        }

        match ch {
            '"' | '\'' => in_quote = Some(ch),
            '[' => bracket_depth += 1,
            ']' => bracket_depth = bracket_depth.saturating_sub(1),
            '>' if bracket_depth == 0 => return Some(index + ch.len_utf8()),
            _ => {}
        }
    }

    None
}

fn parse_tag_content(
    content: &str,
) -> Result<(String, HashMap<String, String>), ScoreExtractError> {
    let mut name = String::new();
    let mut attrs = HashMap::new();
    let mut chars = content.chars().peekable();

    while let Some(ch) = chars.peek() {
        if ch.is_whitespace() {
            break;
        }
        name.push(*ch);
        chars.next();
    }

    if name.is_empty() {
        return Err(ScoreExtractError(
            "Encountered an XML tag without a name".to_owned(),
        ));
    }

    loop {
        while matches!(chars.peek(), Some(ch) if ch.is_whitespace()) {
            chars.next();
        }

        if chars.peek().is_none() {
            break;
        }

        let mut key = String::new();
        while let Some(ch) = chars.peek() {
            if *ch == '=' || ch.is_whitespace() {
                break;
            }
            key.push(*ch);
            chars.next();
        }

        while matches!(chars.peek(), Some(ch) if ch.is_whitespace()) {
            chars.next();
        }

        if chars.next() != Some('=') {
            return Err(ScoreExtractError(format!(
                "Malformed XML attribute on <{}>",
                name
            )));
        }

        while matches!(chars.peek(), Some(ch) if ch.is_whitespace()) {
            chars.next();
        }

        let quote = chars
            .next()
            .ok_or_else(|| ScoreExtractError(format!("Missing quote for <{}> attribute", name)))?;
        if quote != '"' && quote != '\'' {
            return Err(ScoreExtractError(format!(
                "Expected a quoted XML attribute on <{}>",
                name
            )));
        }

        let mut value = String::new();
        loop {
            let Some(ch) = chars.next() else {
                return Err(ScoreExtractError(format!(
                    "Unclosed XML attribute on <{}>",
                    name
                )));
            };
            if ch == quote {
                break;
            }
            value.push(ch);
        }

        attrs.insert(key, value);
    }

    Ok((name, attrs))
}

fn build_score_payload(
    root: &XmlNode,
    source_path: &str,
) -> Result<ScoreDetailPayload, ScoreExtractError> {
    if root.name != "score-partwise" {
        return Err(ScoreExtractError(
            "Only MusicXML score-partwise documents are supported right now.".to_owned(),
        ));
    }

    let part_names = extract_part_names(root);
    let title = root
        .find_first("movement-title")
        .map(|node| node.text.trim().to_owned())
        .or_else(|| {
            root.find_first("work")
                .and_then(|work| work.child_text("work-title"))
        })
        .unwrap_or_else(|| {
            Path::new(source_path)
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("untitled score")
                .to_owned()
        });
    let composer = root
        .find_first_with_attr("creator", "type", "composer")
        .map(|node| node.text.trim().to_owned())
        .or_else(|| {
            root.find_first("creator")
                .map(|node| node.text.trim().to_owned())
        });

    let mut tempo_bpm = None;
    let mut time_signature = None;
    let mut key_signature = None;
    let mut total_beats: f64 = 0.0;
    let mut parts = Vec::new();
    let mut events = Vec::new();

    for part_node in root.children_named("part") {
        let part_id = part_node
            .attrs
            .get("id")
            .cloned()
            .unwrap_or_else(|| format!("part-{}", parts.len() + 1));
        let part_name = part_names
            .get(&part_id)
            .cloned()
            .unwrap_or_else(|| part_id.clone());

        let extracted = extract_part_events(
            part_node,
            &part_id,
            &part_name,
            &mut tempo_bpm,
            &mut time_signature,
            &mut key_signature,
        )?;

        total_beats = total_beats.max(extracted.total_beats);
        events.extend(extracted.events);
        parts.push(ScorePartSummary {
            id: part_id,
            name: part_name,
            measure_count: extracted.measure_count,
            staff_count: extracted.staff_count,
        });
    }

    let total_seconds = tempo_bpm.map(|tempo| total_beats * 60.0 / tempo);
    let source_name = Path::new(source_path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(source_path)
        .to_owned();
    let source_format = Path::new(source_path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_else(|| "xml".to_owned());

    Ok(ScoreDetailPayload {
        source_path: source_path.to_owned(),
        source_name,
        source_format,
        title,
        composer,
        tempo_bpm,
        time_signature,
        key_signature,
        total_beats,
        total_seconds,
        part_count: parts.len(),
        measure_count: parts
            .iter()
            .map(|part| part.measure_count)
            .max()
            .unwrap_or(0),
        note_count: events.len(),
        parts,
        events,
    })
}

fn extract_part_names(root: &XmlNode) -> HashMap<String, String> {
    let mut names = HashMap::new();

    if let Some(part_list) = root.child("part-list") {
        for score_part in part_list.children_named("score-part") {
            if let Some(id) = score_part.attrs.get("id") {
                let name = score_part
                    .child_text("part-name")
                    .unwrap_or_else(|| id.clone());
                names.insert(id.clone(), name);
            }
        }
    }

    names
}

struct ExtractedPart {
    measure_count: usize,
    staff_count: usize,
    total_beats: f64,
    events: Vec<ScoreNoteEvent>,
}

fn extract_part_events(
    part_node: &XmlNode,
    part_id: &str,
    part_name: &str,
    tempo_bpm: &mut Option<f64>,
    time_signature: &mut Option<String>,
    key_signature: &mut Option<String>,
) -> Result<ExtractedPart, ScoreExtractError> {
    let mut divisions_per_quarter = 1.0f64;
    let mut staff_count = 1usize;
    let mut running_beats = 0.0f64;
    let mut measure_count = 0usize;
    let mut events = Vec::new();

    for (measure_index, measure_node) in part_node.children_named("measure").enumerate() {
        measure_count += 1;
        let measure_number = measure_node
            .attrs
            .get("number")
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(measure_index + 1);
        let mut cursor_divisions = 0i32;
        let mut max_cursor_divisions = 0i32;
        let mut last_non_chord_start_divisions = 0i32;

        for child in &measure_node.children {
            match child.name.as_str() {
                "attributes" => {
                    if let Some(next_divisions) = child
                        .child_text("divisions")
                        .and_then(|value| value.parse::<f64>().ok())
                        .filter(|value| *value > 0.0)
                    {
                        divisions_per_quarter = next_divisions;
                    }

                    if let Some(next_staff_count) = child
                        .child_text("staves")
                        .and_then(|value| value.parse::<usize>().ok())
                        .filter(|value| *value > 0)
                    {
                        staff_count = staff_count.max(next_staff_count);
                    }

                    if time_signature.is_none() {
                        if let Some(time) = child.child("time") {
                            let beats = time.child_text("beats");
                            let beat_type = time.child_text("beat-type");
                            if let (Some(beats), Some(beat_type)) = (beats, beat_type) {
                                *time_signature = Some(format!("{beats}/{beat_type}"));
                            }
                        }
                    }

                    if key_signature.is_none() {
                        if let Some(key) = child.child("key") {
                            let fifths = key
                                .child_text("fifths")
                                .and_then(|value| value.parse::<i32>().ok());
                            let mode = key.child_text("mode");
                            *key_signature = map_key_signature(fifths, mode.as_deref());
                        }
                    }
                }
                "direction" => {
                    if tempo_bpm.is_none() {
                        *tempo_bpm = extract_direction_tempo(child);
                    }
                }
                "backup" => {
                    if let Some(duration) = child
                        .child_text("duration")
                        .and_then(|value| value.parse::<i32>().ok())
                    {
                        cursor_divisions -= duration;
                    }
                }
                "forward" => {
                    if let Some(duration) = child
                        .child_text("duration")
                        .and_then(|value| value.parse::<i32>().ok())
                    {
                        cursor_divisions += duration;
                        max_cursor_divisions = max_cursor_divisions.max(cursor_divisions);
                    }
                }
                "note" => {
                    if child.has_child("grace") {
                        continue;
                    }

                    let duration_divisions = child
                        .child_text("duration")
                        .and_then(|value| value.parse::<i32>().ok())
                        .unwrap_or_default();
                    let is_chord_tone = child.has_child("chord");
                    let note_start_divisions = if is_chord_tone {
                        last_non_chord_start_divisions
                    } else {
                        cursor_divisions
                    };
                    let end_divisions = note_start_divisions + duration_divisions;
                    max_cursor_divisions = max_cursor_divisions.max(end_divisions);

                    if !child.has_child("rest") {
                        let (midi, note_name) = parse_pitch(child)?;
                        let staff = child
                            .child_text("staff")
                            .and_then(|value| value.parse::<usize>().ok())
                            .unwrap_or(1);
                        let voice = child.child_text("voice").unwrap_or_else(|| "1".to_owned());
                        let start_beats =
                            running_beats + note_start_divisions as f64 / divisions_per_quarter;
                        let duration_beats = duration_divisions as f64 / divisions_per_quarter;
                        let seconds_per_beat = tempo_bpm.map(|tempo| 60.0 / tempo);

                        events.push(ScoreNoteEvent {
                            id: format!(
                                "{part_id}-{measure_number}-{}-{}",
                                staff,
                                events.len() + 1
                            ),
                            part_id: part_id.to_owned(),
                            part_name: part_name.to_owned(),
                            measure_number,
                            staff,
                            voice,
                            midi,
                            note_name,
                            start_beats,
                            duration_beats,
                            start_seconds: seconds_per_beat.map(|value| start_beats * value),
                            duration_seconds: seconds_per_beat.map(|value| duration_beats * value),
                            is_chord_tone,
                        });
                    }

                    if !is_chord_tone {
                        last_non_chord_start_divisions = note_start_divisions;
                        cursor_divisions += duration_divisions;
                        max_cursor_divisions = max_cursor_divisions.max(cursor_divisions);
                    }
                }
                _ => {}
            }
        }

        running_beats += max_cursor_divisions as f64 / divisions_per_quarter;
    }

    Ok(ExtractedPart {
        measure_count,
        staff_count,
        total_beats: running_beats,
        events,
    })
}

fn extract_direction_tempo(node: &XmlNode) -> Option<f64> {
    if let Some(sound) = node.child("sound") {
        if let Some(tempo) = sound
            .attrs
            .get("tempo")
            .and_then(|value| value.parse::<f64>().ok())
            .filter(|value| *value > 0.0)
        {
            return Some(tempo);
        }
    }

    node.find_first("per-minute")
        .and_then(|value| value.text.trim().parse::<f64>().ok())
        .filter(|value| *value > 0.0)
}

fn parse_pitch(note_node: &XmlNode) -> Result<(i32, String), ScoreExtractError> {
    let pitch = note_node
        .child("pitch")
        .ok_or_else(|| ScoreExtractError("Encountered a note without a pitch".to_owned()))?;
    let step = pitch
        .child_text("step")
        .ok_or_else(|| ScoreExtractError("Pitch was missing a step".to_owned()))?;
    let octave = pitch
        .child_text("octave")
        .and_then(|value| value.parse::<i32>().ok())
        .ok_or_else(|| ScoreExtractError("Pitch was missing an octave".to_owned()))?;
    let alter = pitch
        .child_text("alter")
        .and_then(|value| value.parse::<i32>().ok())
        .unwrap_or(0);

    let semitone = match step.as_str() {
        "C" => 0,
        "D" => 2,
        "E" => 4,
        "F" => 5,
        "G" => 7,
        "A" => 9,
        "B" => 11,
        _ => return Err(ScoreExtractError(format!("Unsupported pitch step: {step}"))),
    };

    let midi = (octave + 1) * 12 + semitone + alter;
    let accidental = match alter {
        -2 => "bb",
        -1 => "b",
        0 => "",
        1 => "#",
        2 => "##",
        _ => "",
    };

    Ok((midi, format!("{step}{accidental}{octave}")))
}

fn map_key_signature(fifths: Option<i32>, mode: Option<&str>) -> Option<String> {
    let fifths = fifths?;
    let major = [
        (-7, "Cb major"),
        (-6, "Gb major"),
        (-5, "Db major"),
        (-4, "Ab major"),
        (-3, "Eb major"),
        (-2, "Bb major"),
        (-1, "F major"),
        (0, "C major"),
        (1, "G major"),
        (2, "D major"),
        (3, "A major"),
        (4, "E major"),
        (5, "B major"),
        (6, "F# major"),
        (7, "C# major"),
    ];
    let minor = [
        (-7, "Ab minor"),
        (-6, "Eb minor"),
        (-5, "Bb minor"),
        (-4, "F minor"),
        (-3, "C minor"),
        (-2, "G minor"),
        (-1, "D minor"),
        (0, "A minor"),
        (1, "E minor"),
        (2, "B minor"),
        (3, "F# minor"),
        (4, "C# minor"),
        (5, "G# minor"),
        (6, "D# minor"),
        (7, "A# minor"),
    ];

    let mode = mode.unwrap_or("major");
    let mapping = if mode.eq_ignore_ascii_case("minor") {
        &minor
    } else {
        &major
    };

    mapping
        .iter()
        .find(|(value, _)| *value == fifths)
        .map(|(_, label)| (*label).to_owned())
}
