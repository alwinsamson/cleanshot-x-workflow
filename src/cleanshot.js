// ==========================================================================
// PROJECT: CleanShot X Alfred Workflow
//
// FILE: cleanshot.js
//
// AUTHOR: AS
//
// START DATE: 11/25/2026
//
// LAST UPDATE: 11/25/2026
//
// --------------------------------------------------------------------------
// OVERVIEW:
//   Everything the workflow does at run time, driven by CleanShot X's URL
//   scheme (https://cleanshot.com/docs-api). Alfred calls it in four ways:
//     list               Script Filter JSON for the main command list
//     presets <query>    Script Filter JSON for recording at a preset size
//     run <arg>          Act on a chosen item (URL, Finder file, trigger)
//     file <cmd> <paths> Act on files sent from Alfred's File Actions
//   Anything printed by run or file is an error for Alfred to post as a
//   notification; success prints nothing. Targets CleanShot X 4.7, so
//   parameters that need 5.0.3 (self-timer area and seconds, fullscreen
//   display and cursor) are not used.
// --------------------------------------------------------------------------
// FUNCTIONS:
//   env                -- Read one environment variable, or ''
//   commandItem        -- Turn a COMMANDS entry into an Alfred item
//   listCommands       -- Script Filter JSON for the main list
//   mainDisplaySize    -- Logical size of the main display
//   parseCustomPresets -- Read the custom_presets configuration text
//   presetItem         -- Alfred item that records at one preset size
//   listPresets        -- Script Filter JSON for the preset list
//   finderSelection    -- POSIX paths selected in Finder
//   openFiles          -- Open one CleanShot URL per supported file
//   openUrl            -- Hand a URL to macOS
//   runArg             -- Act on a chosen main or preset list item
//   run                -- Entry point
// ==========================================================================

ObjC.import('AppKit');

// What to do with a capture once it is taken, per held modifier. Return
// alone uses CleanShot's own after-capture setting.
const CAPTURE_ACTIONS = [
    { mod: 'cmd', action: 'copy', verb: 'copy it to the clipboard' },
    { mod: 'alt', action: 'save', verb: 'save it' },
    { mod: 'ctrl', action: 'annotate', verb: 'open it in Annotate' },
    { mod: 'shift', action: 'upload', verb: 'upload it to CleanShot Cloud' },
    { mod: 'fn', action: 'pin', verb: 'pin it to the screen' }
];

// File-taking commands and the extensions CleanShot accepts for each.
const IMAGE_TYPES = ['png', 'jpg', 'jpeg'];
const FILE_COMMANDS = {
    'pin': { types: IMAGE_TYPES, isFileRequired: false },
    'open-annotate': { types: IMAGE_TYPES, isFileRequired: false },
    'capture-text': { types: IMAGE_TYPES, isFileRequired: true },
    'add-quick-access-overlay': { types: IMAGE_TYPES.concat('mp4'), isFileRequired: true }
};

// arg prefixes: "finder:<command>" uses the Finder selection, "alfred:<x>"
// drives Alfred itself, anything else is a URL to open.
const COMMANDS = [
    { icon: 'all_in_one', title: 'All-in-One',
      subtitle: 'Choose screenshot, recording or scrolling capture on screen',
      arg: 'cleanshot://all-in-one' },
    { icon: 'capture_area', title: 'Capture Area',
      subtitle: 'Screenshot a selected area', arg: 'cleanshot://capture-area',
      isCapture: true },
    { icon: 'capture_previous_area', title: 'Capture Previous Area',
      subtitle: 'Screenshot the last selected area again',
      arg: 'cleanshot://capture-previous-area', isCapture: true },
    { icon: 'capture_fullscreen', title: 'Capture Fullscreen',
      subtitle: 'Screenshot the whole screen',
      arg: 'cleanshot://capture-fullscreen', isCapture: true },
    { icon: 'capture_window', title: 'Capture Window',
      subtitle: 'Screenshot a single window', arg: 'cleanshot://capture-window',
      isCapture: true },
    { icon: 'self_timer', title: 'Self-Timer',
      subtitle: 'Screenshot a selected area after a countdown',
      arg: 'cleanshot://self-timer', isCapture: true },
    { icon: 'scrolling_capture', title: 'Scrolling Capture',
      subtitle: 'Screenshot a scrolling page',
      arg: 'cleanshot://scrolling-capture' },
    { icon: 'capture_text', title: 'Capture Text',
      subtitle: 'Copy the text in a selected area (OCR)',
      arg: 'cleanshot://capture-text', keywords: 'ocr text recognition' },
    { icon: 'record_screen', title: 'Record Screen',
      subtitle: 'Record a video or GIF of the screen',
      arg: 'cleanshot://record-screen', keywords: 'video gif' },
    { icon: 'record_preset', title: 'Record Screen at Preset',
      subtitle: 'Record a centred area at 1080p, 720p, 4K or a custom size',
      arg: 'alfred:presets', keywords: 'video gif resolution size' },
    { icon: 'open_from_clipboard', title: 'Annotate Clipboard Image',
      subtitle: 'Open the image on the clipboard in Annotate',
      arg: 'cleanshot://open-from-clipboard', keywords: 'open from clipboard' },
    { icon: 'open_annotate', title: 'Annotate Image',
      subtitle: 'Open the image selected in Finder in Annotate, or pick one',
      arg: 'finder:open-annotate', keywords: 'open annotate edit' },
    { icon: 'pin', title: 'Pin Image',
      subtitle: 'Float the image selected in Finder above all windows, or pick one',
      arg: 'finder:pin', keywords: 'pin screenshot float' },
    { icon: 'add_quick_access_overlay', title: 'Add Quick Access Overlay',
      subtitle: 'Show the image or MP4 selected in Finder in Quick Access',
      arg: 'finder:add-quick-access-overlay' },
    { icon: 'capture_text_file', title: 'Capture Text from Image',
      subtitle: 'Copy the text in the image selected in Finder (OCR)',
      arg: 'finder:capture-text', keywords: 'ocr text recognition file' },
    { icon: 'open_history', title: 'Open History',
      subtitle: 'Browse past captures', arg: 'cleanshot://open-history' },
    { icon: 'restore_recently_closed', title: 'Restore Recently Closed',
      subtitle: 'Bring back the last closed overlay',
      arg: 'cleanshot://restore-recently-closed', keywords: 'undo reopen' },
    { icon: 'toggle_desktop_icons', title: 'Toggle Desktop Icons',
      subtitle: 'Hide or show desktop icons',
      arg: 'cleanshot://toggle-desktop-icons' },
    { icon: 'hide_desktop_icons', title: 'Hide Desktop Icons',
      subtitle: 'Hide desktop icons', arg: 'cleanshot://hide-desktop-icons' },
    { icon: 'show_desktop_icons', title: 'Show Desktop Icons',
      subtitle: 'Show desktop icons', arg: 'cleanshot://show-desktop-icons' },
    { icon: 'view_uploads', title: 'View Uploads',
      subtitle: 'Open CleanShot Cloud in the browser',
      arg: 'https://cleanshot.cloud/', keywords: 'cloud' },
    { icon: 'open_settings', title: 'Open Settings',
      subtitle: 'Open CleanShot X settings',
      arg: 'cleanshot://open-settings', keywords: 'preferences' }
];

// Tab values accepted by cleanshot://open-settings?tab=
const SETTINGS_TABS = [
    ['general', 'General'], ['wallpaper', 'Wallpaper'],
    ['shortcuts', 'Shortcuts'], ['quickaccess', 'Quick Access'],
    ['recording', 'Recording'], ['screenshots', 'Screenshots'],
    ['annotate', 'Annotate'], ['cloud', 'Cloud'],
    ['advanced', 'Advanced'], ['about', 'About']
];

// scale presets are a fraction of the main display; the rest are pixels
// in CleanShot's logical (point) coordinates.
const BUILT_IN_PRESETS = [
    { name: 'Fullscreen', scale: 1 },
    { name: '75% of Screen', scale: 0.75 },
    { name: '50% of Screen', scale: 0.5 },
    { name: '1080p', width: 1920, height: 1080 },
    { name: '720p', width: 1280, height: 720 },
    { name: '4K', width: 3840, height: 2160 },
    { name: 'Instagram Story', width: 1080, height: 1920 },
    { name: 'YouTube Shorts', width: 1080, height: 1920 }
];


function env(name)
{
    const value = $.NSProcessInfo.processInfo.environment.objectForKey(name);
    return value.isNil() ? '' : value.js;
}


// --------------------------------------------------------------------------
// commandItem -- Turn a COMMANDS entry into an Alfred item
//
//   Capture commands get one modifier per CleanShot after-capture action.
//   Other items get no mods, so a held modifier just does the same as
//   Return.
// --------------------------------------------------------------------------
function commandItem(command)
{
    const item = {
        uid: command.arg,
        title: command.title,
        subtitle: command.subtitle,
        arg: command.arg,
        match: `${command.title} ${command.keywords || ''}`.trim(),
        icon: { path: `icons/${command.icon}.png` }
    };
    if (!command.isCapture) return item;

    item.mods = {};
    for (const entry of CAPTURE_ACTIONS)
    {
        item.mods[entry.mod] = {
            arg: `${command.arg}?action=${entry.action}`,
            subtitle: `${command.title}, then ${entry.verb}`
        };
    }
    return item;
}


function listCommands()
{
    const items = COMMANDS.map(commandItem);
    for (const [tab, label] of SETTINGS_TABS)
    {
        items.push(commandItem({
            icon: 'open_settings',
            title: `Open Settings: ${label}`,
            subtitle: `Open the ${label} tab of CleanShot X settings`,
            arg: `cleanshot://open-settings?tab=${tab}`,
            keywords: 'preferences'
        }));
    }
    return JSON.stringify({ items: items });
}


// --------------------------------------------------------------------------
// mainDisplaySize -- Logical size of the main display
//
// OUTPUT:  { width, height } in points, which is what CleanShot's x, y,
//          width and height parameters use.
//
// WARNINGS:   screens[0] is the display with the menu bar, which is
//             display=1 to CleanShot. Other displays are not offered.
// --------------------------------------------------------------------------
function mainDisplaySize()
{
    const frame = $.NSScreen.screens.objectAtIndex(0).frame;
    return { width: frame.size.width, height: frame.size.height };
}


// --------------------------------------------------------------------------
// parseCustomPresets -- Read the custom_presets configuration text
//
//   One preset per line as "Name = WIDTHxHEIGHT". Blank lines are ignored.
//
// INPUT:   text -- the raw configuration value
//
// OUTPUT:  { presets: [{ name, width, height }], badLines: [string] }
// --------------------------------------------------------------------------
function parseCustomPresets(text)
{
    // ^(.+?)       name, lazily so trailing spaces fall to \s*
    // \s*[=:]\s*   "=" or ":" separator
    // (\d+)\s*[x×]\s*(\d+)\s*$   width "x" or "×" height
    const pattern = /^(.+?)\s*[=:]\s*(\d+)\s*[x×]\s*(\d+)\s*$/i;
    const result = { presets: [], badLines: [] };

    for (const rawLine of text.split('\n'))
    {
        const line = rawLine.trim();
        if (!line) continue;

        const found = line.match(pattern);
        const width = found ? Number(found[2]) : 0;
        const height = found ? Number(found[3]) : 0;
        if (!found || width === 0 || height === 0)
        {
            result.badLines.push(line);
            continue;
        }
        result.presets.push({ name: found[1], width: width, height: height });
    }
    return result;
}


// --------------------------------------------------------------------------
// presetItem -- Alfred item that records at one preset size
//
//   The recording area is centred on the main display. CleanShot puts
//   (0,0) at the bottom-left, which centring makes irrelevant.
//
// INPUT:   preset -- { name, scale } or { name, width, height }
//          screen -- main display size from mainDisplaySize
//          isCustom -- true for user presets, which only changes the uid
// --------------------------------------------------------------------------
function presetItem(preset, screen, isCustom)
{
    const width = preset.scale ? Math.round(screen.width * preset.scale) : preset.width;
    const height = preset.scale ? Math.round(screen.height * preset.scale) : preset.height;
    const x = Math.max(0, Math.round((screen.width - width) / 2));
    const y = Math.max(0, Math.round((screen.height - height) / 2));
    const size = `${width} × ${height}`;
    const isTooBig = width > screen.width || height > screen.height;

    return {
        uid: `preset:${isCustom ? 'custom:' : ''}${preset.name}`,
        title: preset.name,
        subtitle: isTooBig
            ? `${size}, larger than the main display; CleanShot will clip it`
            : `${size}, centred on the main display`,
        arg: `cleanshot://record-screen?x=${x}&y=${y}&width=${width}` +
             `&height=${height}&display=1`,
        icon: { path: `icons/${isTooBig ? 'warning' : 'record_preset'}.png` }
    };
}


// --------------------------------------------------------------------------
// listPresets -- Script Filter JSON for the preset list
//
//   Typing a size like "1440x900" offers it as a one-off preset first.
//   Otherwise the query filters custom presets, then built-in ones.
//
// INPUT:   query -- what the user typed after the keyword
// --------------------------------------------------------------------------
function listPresets(query)
{
    const screen = mainDisplaySize();
    const custom = parseCustomPresets(env('custom_presets'));
    const needle = query.trim().toLowerCase();
    const isMatch = (preset) => preset.name.toLowerCase().includes(needle);
    const items = [];

    // "1440x900", "1440 x 900" or "1440 900"
    const typed = needle.match(/^(\d+)\s*[x×\s]\s*(\d+)$/);
    if (typed && Number(typed[1]) > 0 && Number(typed[2]) > 0)
    {
        const preset = { name: `${typed[1]} × ${typed[2]}`,
                         width: Number(typed[1]), height: Number(typed[2]) };
        items.push(presetItem(preset, screen, true));
    }

    for (const preset of custom.presets.filter(isMatch))
    {
        items.push(presetItem(preset, screen, true));
    }
    for (const preset of BUILT_IN_PRESETS.filter(isMatch))
    {
        items.push(presetItem(preset, screen, false));
    }
    for (const line of custom.badLines)
    {
        items.push({
            title: `Can't read custom preset "${line}"`,
            subtitle: 'Use one preset per line, like "Demo = 1600x1000". ' +
                      'Return opens the configuration.',
            arg: 'alfred:configure',
            icon: { path: 'icons/warning.png' }
        });
    }
    if ('edit custom presets'.includes(needle) || items.length === 0)
    {
        items.push({
            uid: 'edit-presets',
            title: 'Edit Custom Presets',
            subtitle: 'Add sizes as "Name = WIDTHxHEIGHT", one per line, ' +
                      'or type a size like 1440x900',
            arg: 'alfred:configure',
            icon: { path: 'icons/edit_presets.png' }
        });
    }
    return JSON.stringify({ items: items });
}


function finderSelection()
{
    return Application('Finder').selection()
        .map((item) => $.NSURL.URLWithString(item.url()).path.js);
}


// --------------------------------------------------------------------------
// openFiles -- Open one CleanShot URL per supported file
//
// INPUT:   command -- a key of FILE_COMMANDS
//          paths   -- POSIX paths; may be empty
//
// OUTPUT:  An error message for the notification, or undefined when
//          every file was handed to CleanShot.
// --------------------------------------------------------------------------
function openFiles(command, paths)
{
    const spec = FILE_COMMANDS[command];
    if (!spec) throw new Error(`Unknown file command "${command}".`);

    if (paths.length === 0)
    {
        if (spec.isFileRequired) return 'Select a file in Finder first.';
        // CleanShot shows a file picker when filepath is missing.
        openUrl(`cleanshot://${command}`);
        return undefined;
    }

    const skipped = [];
    for (const path of paths)
    {
        const extension = path.split('.').pop().toLowerCase();
        if (!spec.types.includes(extension))
        {
            skipped.push(path.split('/').pop());
            continue;
        }
        openUrl(`cleanshot://${command}?filepath=${encodeURIComponent(path)}`);
    }
    if (skipped.length === 0) return undefined;

    const accepted = spec.types.map((type) => type.toUpperCase()).join(', ');
    return `Skipped ${skipped.join(', ')}: CleanShot only accepts ${accepted} here.`;
}


function openUrl(url)
{
    const isOpened = $.NSWorkspace.sharedWorkspace
        .openURL($.NSURL.URLWithString(url));
    if (!isOpened) throw new Error(`macOS could not open ${url}. Is CleanShot X installed?`);
}


// --------------------------------------------------------------------------
// runArg -- Act on a chosen main or preset list item
//
// INPUT:   arg -- the item's arg; see the note above COMMANDS
//
// OUTPUT:  An error message for the notification, or undefined.
// --------------------------------------------------------------------------
function runArg(arg)
{
    const bundleId = env('alfred_workflow_bundleid');
    const alfred = () => Application('com.runningwithcrayons.Alfred');

    if (arg === 'alfred:presets')
    {
        alfred().runTrigger('presets', { inWorkflow: bundleId, withArgument: '' });
        return undefined;
    }
    if (arg === 'alfred:configure')
    {
        alfred().revealWorkflow(bundleId, { configuration: true });
        return undefined;
    }
    if (arg.startsWith('finder:'))
    {
        return openFiles(arg.slice('finder:'.length), finderSelection());
    }
    openUrl(arg);
    return undefined;
}


function run(argv)
{
    const mode = argv[0];
    if (mode === 'list') return listCommands();
    if (mode === 'presets') return listPresets(argv[1] || '');

    // An uncaught error only reaches Alfred's debugger, so print it for the
    // notification instead, e.g. when CleanShot X is not installed.
    try
    {
        if (mode === 'run') return runArg(argv[1] || '');
        if (mode === 'file')
        {
            // Alfred passes several files either as separate arguments or as
            // one tab-separated argument depending on version; accept both.
            const paths = argv.slice(2).join('\t').split('\t').filter(Boolean);
            return openFiles(argv[1], paths);
        }
    }
    catch (error)
    {
        return error.message;
    }
    throw new Error(`Unknown mode "${mode}". Use list, presets, run or file.`);
}
