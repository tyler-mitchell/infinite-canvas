---
"@hyphened/infinite-canvas": minor
---

A consumer decides what a group's frame label says.

`groupTabLabel` let a consumer replace what a tab or accordion header is called, and the frame label above the shell had no such prop — its text was `getInfiniteCanvasGroupTitle` and nothing else. The two are not always the same question. An unnamed group is named after its members, and over a tab strip that repeats the strip verbatim, one row higher: seen on a two-member tabbed group whose label read "Untitled 1 & Untitled 2" directly above tabs reading "Untitled 1" and "Untitled 2".

The first version of this note justified keeping the label over a _split_ by saying those names appear nowhere else. That is not true — every kind draws its own title inside its pane, and the LOD summary keeps drawing it as the panes shrink, measured at three zooms on a three-pane split. The distinction that does hold is how much is repeated: over a split the composed title is one member's name plus a count, and it names the cluster, which no member title does; over tabs it is the whole list, verbatim, immediately below.

`groupLabel` takes the group and the windows and returns the text. It defaults to the behaviour that was there, so nothing changes for a consumer that does not pass it. Returning `""` draws no label for that group, which is the per-group way to opt out — `chrome.groupLabelSize` still turns every label off at once.
