# Changelog

All notable changes to the SciViewer extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-12

### Added
- Zero-setup auto-injection system for matplotlib plots
- Smart environment detection (venv, conda, pipenv, Jupyter)
- Rich plot metadata tracking (execution context, figure properties, timestamps)
- Status bar integration showing injection status
- Enhanced configuration options for injection behavior
- Automatic panel opening when first plot is detected
- Plot cleanup system (max 100 plots stored)

### Changed
- Improved plot saving quality (150 DPI)
- Better error handling and user feedback
- Enhanced webview UI with modern styling

### Fixed
- Memory leaks in plot storage
- Performance issues with large number of plots

## [0.1.2] - 2025-12-01

### Added
- Initial stable release
- Basic matplotlib plot capture functionality
- Thumbnail gallery for recent plots
- Zoom and pan controls for plot inspection
- Context menu with copy/download options
- Cross-platform clipboard support (macOS, Windows, Linux)

[0.2.0]: https://github.com/ofirbartal100/sciviewer/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/ofirbartal100/sciviewer/releases/tag/v0.1.2
