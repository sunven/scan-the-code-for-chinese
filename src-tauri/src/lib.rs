use ignore::WalkBuilder;
use oxc::allocator::Allocator;
use oxc::ast::ast::{JSXText, StringLiteral, TemplateLiteral};
use oxc::ast::Visit;
use oxc::parser::Parser;
use oxc::span::SourceType;
use regex::Regex;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

#[derive(Debug, Serialize, Clone)]
struct ScanResult {
    #[serde(rename = "filePath")]
    file_path: String,
    line: usize,
    column: usize,
    text: String,
}

// Helper to convert byte offset to line/column
fn get_line_col(source_text: &str, offset: u32) -> (usize, usize) {
    let offset = offset as usize;
    let mut line_start = 0;
    for (line_number, line) in source_text.lines().enumerate() {
        let line_end = line_start + line.len() + 1; // +1 for newline
        if offset >= line_start && offset < line_end {
            return (line_number + 1, offset - line_start + 1);
        }
        line_start = line_end;
    }
    (source_text.lines().count() + 1, 1) // Fallback
}

struct ChineseVisitor<'a> {
    results: Arc<Mutex<Vec<ScanResult>>>,
    file_path: PathBuf,
    source_text: &'a str,
    chinese_regex: Regex,
}

impl<'a> Visit<'a> for ChineseVisitor<'a> {
    fn visit_string_literal(&mut self, lit: &StringLiteral<'a>) {
        if let Some(mat) = self.chinese_regex.find(&lit.value) {
            // +1 to account for the opening quote "
            let absolute_offset = lit.span.start + 1 + mat.start() as u32;
            let (line, column) = get_line_col(self.source_text, absolute_offset);
            self.results.lock().unwrap().push(ScanResult {
                file_path: self.file_path.to_string_lossy().to_string(),
                line,
                column,
                text: lit.value.to_string(),
            });
        }
    }

    fn visit_template_literal(&mut self, lit: &TemplateLiteral<'a>) {
        for part in &lit.quasis {
            if let Some(cooked) = &part.value.cooked {
                if let Some(mat) = self.chinese_regex.find(cooked) {
                    let absolute_offset = part.span.start + mat.start() as u32;
                    let (line, column) = get_line_col(self.source_text, absolute_offset);
                    self.results.lock().unwrap().push(ScanResult {
                        file_path: self.file_path.to_string_lossy().to_string(),
                        line,
                        column,
                        text: cooked.to_string(),
                    });
                }
            }
        }
    }

    fn visit_jsx_text(&mut self, text: &JSXText<'a>) {
        if let Some(mat) = self.chinese_regex.find(&text.value) {
            let absolute_offset = text.span.start + mat.start() as u32;
            let (line, column) = get_line_col(self.source_text, absolute_offset);
            let trimmed_value = text.value.trim();

            if !trimmed_value.is_empty() {
                self.results.lock().unwrap().push(ScanResult {
                    file_path: self.file_path.to_string_lossy().to_string(),
                    line,
                    column,
                    text: trimmed_value.to_string(),
                });
            }
        }
    }
}

#[tauri::command]
fn scan_directory(path: String, exclude: String) -> Result<Vec<ScanResult>, String> {
    let results = Arc::new(Mutex::new(Vec::new()));
    let path = Path::new(&path);

    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", path.display()));
    }

    let mut walk_builder = WalkBuilder::new(path);
    walk_builder.hidden(false); // Respect .gitignore but not other hidden files by default

    // Add exclude patterns
    for pattern in exclude.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()) {
        walk_builder.add_ignore(format!("!{}", pattern));
    }

    let chinese_regex = Regex::new(r"[\u4e00-\u9fa5]").map_err(|e| e.to_string())?;

    for result in walk_builder.build() {
        let entry = match result {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        let file_path = entry.path();
        if !file_path.is_file() {
            continue;
        }

        let extension = file_path.extension().and_then(|s| s.to_str());
        let source_type = match extension {
            Some("js") => SourceType::from_path(file_path).unwrap().with_script(true),
            Some("jsx") => SourceType::from_path(file_path).unwrap().with_jsx(true),
            Some("ts") => SourceType::from_path(file_path).unwrap().with_typescript(true),
            Some("tsx") => SourceType::from_path(file_path).unwrap().with_typescript(true).with_jsx(true),
            _ => continue,
        };

        let source_text = match fs::read_to_string(file_path) {
            Ok(text) => text,
            Err(_) => continue, // Skip files we can't read
        };

        let allocator = Allocator::default();
        let parser = Parser::new(&allocator, &source_text, source_type);
        let ret = parser.parse();

        if !ret.errors.is_empty() {
            // Optionally, you could log parsing errors here
            continue;
        }

        let mut visitor = ChineseVisitor {
            results: Arc::clone(&results),
            file_path: file_path.to_path_buf(),
            source_text: &source_text,
            chinese_regex: chinese_regex.clone(),
        };

        visitor.visit_program(&ret.program);
    }

    let final_results = results.lock().unwrap().clone();
    Ok(final_results)
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![scan_directory])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}