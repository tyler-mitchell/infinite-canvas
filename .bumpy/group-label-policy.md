---
"@hyphened/infinite-canvas": minor
---

A consumer decides what a group's frame label says.

`groupTabLabel` let a consumer replace what a tab or accordion header is called, and the frame label above the shell had no such prop — its text was `getInfiniteCanvasGroupTitle` and nothing else. The two are not always the same question. An unnamed group is named after its members, which reads well over a split, where those names appear nowhere else; over a tab strip it repeats the strip verbatim, one row higher. Seen on a two-member tabbed group whose label read "Untitled 1 & Untitled 2" directly above tabs reading "Untitled 1" and "Untitled 2".

`groupLabel` takes the group and the windows and returns the text. It defaults to the behaviour that was there, so nothing changes for a consumer that does not pass it. Returning `""` draws no label for that group, which is the per-group way to opt out — `chrome.groupLabelSize` still turns every label off at once.
