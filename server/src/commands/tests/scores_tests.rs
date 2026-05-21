use super::unique_test_suffix;
use crate::scores::extract_score_from_path;
use std::io::Write;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;

#[test]
fn extract_score_reads_musicxml_and_normalizes_note_timing() {
    let root = std::env::temp_dir().join(unique_test_suffix("resona-score"));
    std::fs::create_dir_all(&root).expect("score fixture directory should be created");
    let path = root.join("prelude.musicxml");
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <movement-title>Prelude in C</movement-title>
  <identification>
    <creator type="composer">J. S. Bach</creator>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <key>
          <fifths>0</fifths>
          <mode>major</mode>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <staves>2</staves>
      </attributes>
      <direction placement="above">
        <direction-type>
          <metronome>
            <beat-unit>quarter</beat-unit>
            <per-minute>96</per-minute>
          </metronome>
        </direction-type>
        <sound tempo="96"/>
      </direction>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <voice>1</voice>
        <type>half</type>
        <staff>1</staff>
      </note>
      <note>
        <chord/>
        <pitch>
          <step>E</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <voice>1</voice>
        <type>half</type>
        <staff>1</staff>
      </note>
      <note>
        <pitch>
          <step>G</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <voice>1</voice>
        <type>half</type>
        <staff>1</staff>
      </note>
      <backup>
        <duration>8</duration>
      </backup>
      <note>
        <pitch>
          <step>C</step>
          <octave>3</octave>
        </pitch>
        <duration>8</duration>
        <voice>2</voice>
        <type>whole</type>
        <staff>2</staff>
      </note>
    </measure>
    <measure number="2">
      <note>
        <rest/>
        <duration>8</duration>
        <voice>1</voice>
        <type>whole</type>
        <staff>1</staff>
      </note>
    </measure>
  </part>
</score-partwise>
"#;
    std::fs::write(&path, xml).expect("score fixture should be written");

    let payload = extract_score_from_path(path.to_str().expect("path should be utf8"))
        .expect("score extraction should succeed");

    assert_eq!(payload.title, "Prelude in C");
    assert_eq!(payload.composer.as_deref(), Some("J. S. Bach"));
    assert_eq!(payload.source_format, "musicxml");
    assert_eq!(payload.tempo_bpm, Some(96.0));
    assert_eq!(payload.time_signature.as_deref(), Some("4/4"));
    assert_eq!(payload.key_signature.as_deref(), Some("C major"));
    assert_eq!(payload.part_count, 1);
    assert_eq!(payload.measure_count, 2);
    assert_eq!(payload.note_count, 4);
    assert_eq!(payload.parts[0].staff_count, 2);
    assert_eq!(payload.total_beats, 8.0);

    let upper = &payload.events[0];
    assert_eq!(upper.note_name, "C4");
    assert_eq!(upper.midi, 60);
    assert_eq!(upper.staff, 1);
    assert_eq!(upper.start_beats, 0.0);
    assert_eq!(upper.duration_beats, 2.0);
    assert_eq!(upper.start_seconds, Some(0.0));
    assert_eq!(upper.duration_seconds, Some(1.25));

    let chord = &payload.events[1];
    assert_eq!(chord.note_name, "E4");
    assert!(chord.is_chord_tone);
    assert_eq!(chord.start_beats, 0.0);

    let bass = &payload.events[3];
    assert_eq!(bass.note_name, "C3");
    assert_eq!(bass.staff, 2);
    assert_eq!(bass.start_beats, 0.0);
    assert_eq!(bass.duration_beats, 4.0);
}

#[test]
fn extract_score_reads_compressed_musicxml_archives() {
    let root = std::env::temp_dir().join(unique_test_suffix("resona-score-mxl"));
    std::fs::create_dir_all(&root).expect("score fixture directory should be created");
    let path = root.join("prelude.mxl");
    let file = std::fs::File::create(&path).expect("fixture should be created");
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let container_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0">
  <rootfiles>
    <rootfile full-path="scores/prelude.musicxml" media-type="application/vnd.recordare.musicxml+xml"/>
  </rootfiles>
</container>
"#;
    let score_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <movement-title>Compressed Prelude</movement-title>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
      </attributes>
      <direction>
        <direction-type>
          <metronome>
            <beat-unit>quarter</beat-unit>
            <per-minute>120</per-minute>
          </metronome>
        </direction-type>
      </direction>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
        <staff>1</staff>
      </note>
    </measure>
  </part>
</score-partwise>
"#;

    zip.start_file("META-INF/container.xml", options)
        .expect("container.xml should be added");
    zip.write_all(container_xml.as_bytes())
        .expect("container.xml should be written");
    zip.start_file("scores/prelude.musicxml", options)
        .expect("score file should be added");
    zip.write_all(score_xml.as_bytes())
        .expect("score file should be written");
    zip.finish().expect("zip archive should finish");

    let payload = extract_score_from_path(path.to_str().expect("path should be utf8"))
        .expect("mxl extraction should succeed");

    assert_eq!(payload.source_format, "mxl");
    assert_eq!(payload.title, "Compressed Prelude");
    assert_eq!(payload.note_count, 1);
    assert_eq!(payload.events[0].note_name, "C4");
    assert_eq!(payload.events[0].start_beats, 0.0);
    assert_eq!(payload.events[0].duration_seconds, Some(0.5));
}
