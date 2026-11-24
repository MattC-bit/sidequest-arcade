# Release plan · SideQuest 1.2.0

## Candidate

This release adds two visible resize grips, local window-size and position memory, and reset controls in the floating title bar and toolbar. It includes new artwork derived from the game engine, an offline beginner guide, a public README and FAQ, and the PolyForm Noncommercial 1.0.0 license. Version 1.2.0 targets Chrome and other desktop browsers that can load unpacked Chrome extensions. This source package is prepared for publication.

## Prepare the downloads

From a clean copy of the source, run `python tools/package-release.py ../dist`. The player ZIP contains the installable SideQuest folder, an offline guide, and notices. The source ZIP also includes QA and maintainer tools. All runtime dependencies are bundled. Developers can rebuild the guide with Pandoc and `python tools/build-guide.py`; rebuild artwork with `npm install` and `node tools/render-art.cjs`.

## Release sequence

| Step | Evidence or action |
| --- | --- |
| 1. Qualify the package | Run the tests in QA.md against extracted release files. Compare the extension files in both archives and verify the version. |
| 2. Verify a fresh installation | Complete the desktop browser checks in QA.md using the exact player download, then repeat the in-place upgrade from 1.1.1. Record observed results. |
| 3. Prepare the public repository | Choose the intended publishing account and public commit identity. Import a clean source tree. Review the staged files, asset and license notices, author metadata, and README links. |
| 4. Publish the GitHub Release | After publication is authorized, tag the tested commit v1.2.0 and attach the verified player ZIP. Include a SHA-256 checksum and the launch notes below. |
| 5. Verify the public download | Download it from the public page as a visitor, compare its checksum, extract it, and follow START-HERE.html. |

## Release notes

Play one of 50 short games in your ChatGPT tab while a reply is in progress. A floating game can be dragged by its title bar and resized from either lower corner. SideQuest remembers where you left it. The star beside Pause saves the current game. After a round, use the dice to jump straight into a different game. Reset the window at any time in the title bar or toolbar. Open START-HERE.html in the download for installation, troubleshooting, and an explanation of the extension’s page access and local storage.

For rollback, restore the previous release files in the same extension folder, reload SideQuest and refresh your chats. Existing preferences remain compatible; version 1.1.1 ignores the new geometry setting.
