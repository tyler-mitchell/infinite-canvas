---
"@hyphened/infinite-canvas": major
---

Moved layout calculations into the math package and made column definitions composable ArkType schemas.
Separated authored placement from drag collision resolution. Layouts own child positions during drag
and after release. Removed the `dragMotion` prop and drag transition CSS variables.
