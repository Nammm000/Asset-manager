---
description: Lombok and MapStruct wiring — annotation processor ordering in pom.xml and response-building conventions
globs: ["pom.xml", "src/main/java/**/*.java"]
alwaysApply: false
---

# Code Generation

- Lombok + MapStruct are wired via `annotationProcessorPaths` in `pom.xml` (with `lombok-mapstruct-binding` — keep that ordering if you touch the POM).
- Constructor injection is used throughout.
- Controllers/services build responses through `AssetUtils.getResponseEntity` and constants in `constants/`.