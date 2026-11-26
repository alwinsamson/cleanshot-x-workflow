## Usage

Control [CleanShot X](https://cleanshot.com) from Alfred via its URL scheme. Needs CleanShot X 4.7 or later.

Type a command's name straight into Alfred, like `capture area`, `pin image` or `open settings recording`. Or type `cs` or `csx` to list every command: All-in-One, Capture Area, Previous Area, Fullscreen, Window, Self-Timer, Scrolling Capture, Capture Text (OCR), Record Screen, Annotate, Pin, Quick Access, History, Restore Recently Closed, desktop icons, CleanShot Cloud uploads and each Settings tab.

![The csx command list](images/about/csx.png)

### After-capture actions

On Capture Area, Previous Area, Fullscreen, Window and Self-Timer:

* <kbd>↩</kbd> Use CleanShot's own after-capture setting.
* <kbd>⌘</kbd><kbd>↩</kbd> Copy to the clipboard.
* <kbd>⌥</kbd><kbd>↩</kbd> Save.
* <kbd>⌃</kbd><kbd>↩</kbd> Open in Annotate.
* <kbd>⇧</kbd><kbd>↩</kbd> Upload to CleanShot Cloud.
* <kbd>fn</kbd><kbd>↩</kbd> Pin to the screen.

### Files

Annotate Image, Pin Image, Add Quick Access Overlay and Capture Text from Image use the files selected in Finder. With nothing selected, Annotate and Pin ask you to pick a file.

The same four commands are Alfred File Actions: find a PNG or JPEG (or MP4 for Quick Access) in Alfred, press <kbd>⇥</kbd> and pick one.

### Record at a preset size

Type `csr` for Fullscreen, 75%, 50%, 1080p, 720p, 4K and vertical 1080 × 1920, centred on the main display. Type a size such as `csr 1440x900` to record at it once.

![Recording presets via csr](images/about/csr.png)

Save your own sizes under Configure Workflow → Custom Recording Presets, one per line:

```
Demo = 1600x1000
Square = 1080x1080
```

### Quit

Type `csq` to quit CleanShot X.

![Quitting CleanShot X via csq](images/about/csq.png)

The first time you run a command, macOS asks whether Alfred may control Finder or open CleanShot X. Allow it.
