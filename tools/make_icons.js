// ==========================================================================
// PROJECT: CleanShot X Alfred Workflow
//
// FILE: make_icons.js
//
// AUTHOR: AS
//
// START DATE: 11/25/2026
//
// LAST UPDATE: 11/25/2026
//
// --------------------------------------------------------------------------
// OVERVIEW:
//   Draws one icon per workflow command from SF Symbols so they can be
//   regenerated instead of hand-edited. Run from the project root:
//     osascript -l JavaScript tools/make_icons.js "$PWD/assets"
//   Output: assets/icons/<name>.png, one per entry in SYMBOLS. The names
//   must match the icon names used in src/cleanshot.js.
// --------------------------------------------------------------------------
// FUNCTIONS:
//   drawSymbol -- Render one SF Symbol in a flat colour
//   run        -- Entry point
// ==========================================================================

ObjC.import('AppKit');

// User-editable settings
const ICON_SIZE = 128;
const GREY = [0.56, 0.56, 0.58];
const SYMBOLS = {
    'all_in_one': 'square.on.square.dashed',
    'capture_area': 'rectangle.dashed',
    'capture_previous_area': 'rectangle.dashed.badge.record',
    'capture_fullscreen': 'display',
    'capture_window': 'macwindow',
    'self_timer': 'timer',
    'scrolling_capture': 'scroll',
    'capture_text': 'text.viewfinder',
    'capture_text_file': 'doc.text.viewfinder',
    'record_screen': 'record.circle',
    'record_preset': 'aspectratio',
    'open_from_clipboard': 'doc.on.clipboard',
    'open_annotate': 'pencil.tip.crop.circle',
    'pin': 'pin',
    'add_quick_access_overlay': 'rectangle.stack.badge.plus',
    'open_history': 'clock.arrow.circlepath',
    'restore_recently_closed': 'arrow.uturn.backward.circle',
    'toggle_desktop_icons': 'menubar.dock.rectangle',
    'hide_desktop_icons': 'eye.slash',
    'show_desktop_icons': 'eye',
    'view_uploads': 'icloud.and.arrow.up',
    'open_settings': 'gearshape',
    'edit_presets': 'slider.horizontal.3',
    'warning': 'exclamationmark.triangle'
};


// --------------------------------------------------------------------------
// drawSymbol -- Render one SF Symbol in a flat colour on transparency
// --------------------------------------------------------------------------
function drawSymbol(path, symbolName, size, colour)
{
    const base = $.NSImage
        .imageWithSystemSymbolNameAccessibilityDescription(symbolName, symbolName);
    if (base.isNil())
    {
        throw new Error(`SF Symbol "${symbolName}" does not exist on this macOS. ` +
                        'Pick another name in SYMBOLS.');
    }

    const rep = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(
        null, size, size, 8, 4, true, false, $.NSDeviceRGBColorSpace, 0, 0);
    $.NSGraphicsContext.saveGraphicsState;
    $.NSGraphicsContext.setCurrentContext(
        $.NSGraphicsContext.graphicsContextWithBitmapImageRep(rep));

    // Weight 0.4 is NSFontWeightSemibold; scale 3 is large. 0.5 rather than
    // the calculator's 0.55 because wide symbols like macwindow hit the edge.
    const config = $.NSImageSymbolConfiguration
        .configurationWithPointSizeWeightScale(size * 0.5, 0.4, 3);
    const symbol = base.imageWithSymbolConfiguration(config);
    const w = symbol.size.width;
    const h = symbol.size.height;

    // Symbols draw black; fill over them with sourceAtop to recolour.
    const tinted = $.NSImage.alloc.initWithSize(symbol.size);
    tinted.lockFocus;
    symbol.drawInRectFromRectOperationFraction($.NSMakeRect(0, 0, w, h), $.NSZeroRect, 2, 1);
    $.NSColor.colorWithSRGBRedGreenBlueAlpha(colour[0], colour[1], colour[2], 1).set;
    $.NSRectFillUsingOperation($.NSMakeRect(0, 0, w, h), 3);
    tinted.unlockFocus;

    tinted.drawInRectFromRectOperationFraction(
        $.NSMakeRect((size - w) / 2, (size - h) / 2, w, h), $.NSZeroRect, 2, 1);
    $.NSGraphicsContext.restoreGraphicsState;

    rep.representationUsingTypeProperties(4, $()).writeToFileAtomically(path, true);
}


function run(argv)
{
    const outDir = argv[0];
    if (!outDir) throw new Error('Usage: osascript -l JavaScript make_icons.js <assets dir>');

    $.NSFileManager.defaultManager
        .createDirectoryAtPathWithIntermediateDirectoriesAttributesError(
            `${outDir}/icons`, true, $(), $());

    for (const name of Object.keys(SYMBOLS))
    {
        drawSymbol(`${outDir}/icons/${name}.png`, SYMBOLS[name], ICON_SIZE, GREY);
    }
}
