#!/usr/bin/env zsh
############################################################################
# PROJECT: CleanShot X Alfred Workflow                                     #
#                                                                          #
# FILE: build.sh                                                           #
#                                                                          #
# AUTHOR: AS                                                               #
#                                                                          #
# START DATE: 11/25/2026                                                   #
#                                                                          #
# LAST UPDATE: 11/25/2026                                                  #
#                                                                          #
#--------------------------------------------------------------------------#
# OVERVIEW:                                                                #
#   Generates the workflow's info.plist and packages it with               #
#   src/cleanshot.js and the icons into dist/CleanShotX.alfredworkflow.    #
#   Icons come from assets/icons; regenerate them with                     #
#   tools/make_icons.js. assets/icon.png is a 512 px copy of               #
#   assets/icon_source.png, full-bleed with no margin so that it fills     #
#   Alfred's icon frame; readme screenshots live in                        #
#   assets/about. Needs jq. Safe to re-run; the package is staged from     #
#   scratch in a temporary folder every time.                              #
#--------------------------------------------------------------------------#
# FUNCTIONS:                                                               #
#   make_info_plist -- Write info.plist; readme from workflow_readme.md    #
#==========================================================================#
set -euo pipefail

readonly ROOT="${0:A:h}"
# Staged outside ~/Documents because a Hazel rule there renames hyphens in
# filenames to underscores, which breaks the <uid>.png keyword icons.
readonly STAGE="$(mktemp -d)/workflow"
readonly OUTPUT="${ROOT}/dist/CleanShotX.alfredworkflow"


make_info_plist()
{
    # The main list's items double as the spec for the per-command keywords,
    # so the command list lives only in cleanshot.js.
    local items
    items="$(/usr/bin/osascript -l JavaScript "${ROOT}/src/cleanshot.js" list | jq .items)"

    jq -n --rawfile readme "${ROOT}/assets/workflow_readme.md" \
        --argjson items "${items}" '
      def uid(n): "C5A0C5A0-0000-4000-8000-\(n | tostring | ("000000000000" + .) | .[-12:])";
      def js(args): "/usr/bin/osascript -l JavaScript ./cleanshot.js \(args)";
      def filter(n; kw; title; sub; script; alfredFilters): {
        uid: uid(n), type: "alfred.workflow.input.scriptfilter", version: 3,
        config: {
          keyword: kw, withspace: true, argumenttype: 1,
          title: title, subtext: sub, runningsubtext: "",
          type: 11, scriptargtype: 1, escaping: 102, script: script, scriptfile: "",
          alfredfiltersresults: alfredFilters, alfredfiltersresultsmatchmode: 0,
          argumenttreatemptyqueryasnil: false, argumenttrimmode: 0,
          queuemode: 2, queuedelaymode: 0, queuedelaycustom: 3,
          queuedelayimmediatelyinitially: true, skipuniversalaction: true
        }
      };
      def script(n; body): {
        uid: uid(n), type: "alfred.workflow.action.script", version: 2,
        config: { concurrently: false, escaping: 102, script: body,
                  scriptargtype: 1, scriptfile: "", type: 11 }
      };
      def fileaction(n; name; types): {
        uid: uid(n), type: "alfred.workflow.trigger.action", version: 1,
        config: { name: name, filetypes: types, acceptsmulti: 1 }
      };
      def link(dest; mods): { destinationuid: dest.uid, modifiers: mods,
                              modifiersubtext: "", vitoclose: false };
      # Alfred only matches a keyword from its first letter, so to match any
      # word in a title, every word-suffix becomes an alternative:
      # "All-in-One" -> "all in one||in one||one||all-in-one".
      def keywordFor(title):
        (title | ascii_downcase | gsub(":"; "")) as $plain
        | ($plain | gsub("-"; " ") | split(" ")) as $words
        | [range(0; $words | length) | $words[.:] | join(" ")] + [$plain]
        | unique_by(.) as $set
        | ([$set[] | select(. == ($words | join(" ")))]
           + [$set[] | select(. != ($words | join(" ")))])
        | join("||");

      # Modifier bitmasks Alfred uses on connections.
      { cmd: 1048576, alt: 524288, ctrl: 262144, shift: 131072, fn: 8388608 } as $mod
      | ["public.png", "public.jpeg"] as $images

      | filter(1; "{var:keyword}"; "CleanShot X";
               "Capture, record, annotate and pin with CleanShot X";
               js("list"); true) as $main
      | script(2; js("run \"$1\"")) as $run
      | { uid: uid(3), type: "alfred.workflow.output.notification", version: 1,
          config: { title: "CleanShot X", text: "{query}",
                    onlyshowifquerypopulated: true,
                    lastpathcomponent: false, removeextension: false } } as $notify
      | { uid: uid(4), type: "alfred.workflow.trigger.external", version: 1,
          config: { triggerid: "presets", availableviaurlhandler: false } } as $presetTrigger
      | filter(5; "{var:preset_keyword}"; "Record Screen at Preset";
               "Record a centred area at a preset or typed size";
               js("presets \"${1:-}\""); false) as $presets
      | [ { n: 6, name: "Pin with CleanShot X", cmd: "pin", types: $images },
          { n: 7, name: "Annotate with CleanShot X", cmd: "open-annotate", types: $images },
          { n: 8, name: "Add to CleanShot X Quick Access", cmd: "add-quick-access-overlay",
            types: ($images + ["public.mpeg-4"]) },
          { n: 9, name: "Capture Text with CleanShot X", cmd: "capture-text", types: $images }
        ] as $fileSpecs
      | ($fileSpecs | map(fileaction(.n; .name; .types))) as $fileActions
      | ($fileSpecs | map(script(.n + 10; js("file \(.cmd) \"$@\"")))) as $fileScripts
      | { uid: uid(30), type: "alfred.workflow.input.keyword", version: 1,
          config: { keyword: "{var:quit_keyword}", text: "Quit CleanShot X",
                    subtext: "", argumenttype: 2, withspace: false,
                    skipuniversalaction: true } } as $quitKeyword
      | { uid: uid(31), type: "alfred.workflow.automation.task", version: 1,
          config: { taskuid: "com.alfredapp.automation.core/macOS/app.quit",
                    tasksettings: { app_list: "CleanShot X.app" } } } as $quit

      # One Keyword per command so it can be typed straight into Alfred.
      # Each held modifier gets its own Run Script with that action baked in.
      | ($items | to_entries | map(
          .key as $i | .value as $item
          | { keyword: { uid: uid(500 + $i), type: "alfred.workflow.input.keyword", version: 1,
                         config: { keyword: keywordFor($item.title), text: $item.title,
                                   subtext: $item.subtitle, argumenttype: 2,
                                   withspace: false, skipuniversalaction: true } },
              icon: $item.icon.path,
              row: $i,
              targets: ([{ mods: 0, subtitle: "", arg: $item.arg }]
                        + (($item.mods // {}) | to_entries
                           | map({ mods: $mod[.key], subtitle: .value.subtitle,
                                   arg: .value.arg })))
                       | to_entries
                       | map(.value + { col: .key,
                                        script: script(1000 + $i * 10 + .key;
                                                       js("run \(.value.arg | @sh)")) }) }
        )) as $direct

      | {
          bundleid: "com.alwinsamson.cleanshotx",
          name: "CleanShot X",
          description: "Capture, record, annotate and pin with CleanShot X",
          category: "Tools",
          createdby: "Alwin Samson",
          webaddress: "https://alwinsamson.com",
          version: "1.0",
          disabled: false,
          readme: $readme,
          variablesdontexport: [],
          userconfigurationconfig: [
            { type: "textfield", variable: "keyword", label: "Keyword",
              description: "Lists every CleanShot X command. Separate alternatives with ||.",
              config: { default: "csx||cs", placeholder: "csx||cs", required: true, trim: true } },
            { type: "textfield", variable: "preset_keyword", label: "Preset Keyword",
              description: "Records at a preset size, e.g. \"csr 1440x900\".",
              config: { default: "csr", placeholder: "csr", required: true, trim: true } },
            { type: "textfield", variable: "quit_keyword", label: "Quit Keyword",
              description: "Quits CleanShot X.",
              config: { default: "csq", placeholder: "csq", required: true, trim: true } },
            { type: "textarea", variable: "custom_presets", label: "Custom Recording Presets",
              description: "One per line as Name = WIDTHxHEIGHT, e.g. Demo = 1600x1000. Sizes are in points, centred on the main display.",
              config: { default: "", required: false, trim: true, verticalsize: 5 } }
          ],
          objects: ([$main, $run, $notify, $presetTrigger, $presets]
                    + $fileActions + $fileScripts + [$quitKeyword, $quit]
                    + ($direct | map(.keyword))
                    + ($direct | map(.targets[].script))),
          # Not an Alfred key: the build copies these icons to <uid>.png and
          # deletes the key before writing info.plist.
          _icons: ($direct | map({ key: .keyword.uid, value: .icon }) | from_entries),
          connections: ({
            ($main.uid): ([link($run; 0)] + ([$mod[]] | map(link($run; .)))),
            ($presets.uid): [link($run; 0)],
            ($presetTrigger.uid): [link($presets; 0)],
            ($run.uid): [link($notify; 0)],
            ($quitKeyword.uid): [link($quit; 0)]
          }
          + ([range(0; $fileActions | length)]
             | map({ key: $fileActions[.].uid, value: [link($fileScripts[.]; 0)] })
             | from_entries)
          + ($fileScripts | map({ key: .uid, value: [link($notify; 0)] }) | from_entries)
          + ($direct | map({ key: .keyword.uid,
                             value: (.targets | map(link(.script; .mods)
                                                    + { modifiersubtext: .subtitle })) })
             | from_entries)
          + ($direct | map(.targets[]
                           | { key: .script.uid, value: [link($notify; 0)] })
             | from_entries)),
          uidata: ({
            ($main.uid): { xpos: 40, ypos: 40 },
            ($presetTrigger.uid): { xpos: 40, ypos: 190 },
            ($presets.uid): { xpos: 220, ypos: 190 },
            ($run.uid): { xpos: 420, ypos: 40 },
            ($notify.uid): { xpos: 620, ypos: 40 },
            ($quitKeyword.uid): { xpos: 40, ypos: 940 },
            ($quit.uid): { xpos: 220, ypos: 940 }
          }
          + ([range(0; $fileActions | length)]
             | map({ key: $fileActions[.].uid, value: { xpos: 40, ypos: (340 + . * 150) } })
             | from_entries)
          + ([range(0; $fileScripts | length)]
             | map({ key: $fileScripts[.].uid, value: { xpos: 420, ypos: (340 + . * 150) } })
             | from_entries)
          + ($direct | map({ key: .keyword.uid,
                             value: { xpos: 40, ypos: (1100 + .row * 130) } }) | from_entries)
          + ($direct | map(.row as $row | .targets[]
                           | { key: .script.uid,
                               value: { xpos: (260 + .col * 190), ypos: (1100 + $row * 130) } })
             | from_entries))
        }' > "${STAGE}/info.json"

    # Alfred shows <uid>.png in the workflow folder as an object's icon.
    jq -r '._icons | to_entries[] | "\(.key)\t\(.value)"' "${STAGE}/info.json" \
        | while IFS=$'\t' read -r uid icon
          do
              cp "${STAGE}/${icon}" "${STAGE}/${uid}.png"
          done
    jq 'del(._icons)' "${STAGE}/info.json" > "${STAGE}/info.clean.json"
    mv "${STAGE}/info.clean.json" "${STAGE}/info.json"

    plutil -convert xml1 -o "${STAGE}/info.plist" "${STAGE}/info.json"
    rm "${STAGE}/info.json"
    plutil -lint -s "${STAGE}/info.plist"
}


rm -f "${OUTPUT}"
mkdir -p "${STAGE}" "${ROOT}/dist"
cp "${ROOT}/src/cleanshot.js" "${ROOT}/assets/icon.png" "${STAGE}/"
cp -R "${ROOT}/assets/icons" "${STAGE}/icons"
mkdir -p "${STAGE}/images"
cp -R "${ROOT}/assets/about" "${STAGE}/images/about"
make_info_plist

# Finder drops .DS_Store files into assets/about; keep them out.
(cd "${STAGE}" && zip -qry "${OUTPUT}" . -x '*.DS_Store')
rm -rf "${STAGE:h}"
print "Built ${OUTPUT} ($(du -h "${OUTPUT}" | cut -f1))"
