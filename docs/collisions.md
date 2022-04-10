# Handling Path Name Collisions 


## Overview

Permanent’s file system allows users to upload **files and folders** with exactly the same name in the same parent folder.** In the context of computers this is referred to as a **name collision.** 


**In traditional file systems, name collisions are not allowed**. Typically such file systems handle name collisions by appending a number that uniquely identifies the incoming file (or folder)  within parentheses. Sometimes there’s a possibility to override or replace duplicates but this is not a consideration for Permanent and rclone. 

To achieve Permanent’s feature goal of letting it synchronize with other filesystems, a way needs to be found to ensure **name collisions which are allowed within permanent can be safely transferred and mirrored on external file systems that do not allow name collisions.**


## Name collision handling algorithm for external filesystems

Since Permanent already knows how to handle collisions the deduplication mechanism is designed to ensure that mapping files from Permanent to other file systems first of all works and then, assumes a structure similar to the one it had on permanent to the greatest extent possible. This makes it easy for users to easily identify their file structure out of Permanent.

To make this possible, a new property `downloadName` would be added to the data models of files and folders each. The intention is that it is the downloadName that would be used when mapping files and folders from Permanent’s file system to other file systems.


## Definitions


###  Conflict/Name Collision


There is a name collision or conflict **IF more than one file and or folder in the same directory** has **the same name and extension when applicable. Summarily;**



* More than one file with an exact name and extension is a conflict
* More than one folder with an exact name including extension
* More than one folder and file with an exact name including or excluding extension


###  Siblings

Files and folders that are inside the same directory would be referred to as **siblings.**


## How does `downloadName` work

The value of the **_downloadName_** field is obtained from the **_displayName._** This implies `downloadName = displayName + file_extension` when there is no naming conflict.

In the event of a conflict,

For example if a folder has five 5 with the same name say **_A.txt _** the five files would have downloadName ‘s as `A, A (1).txt, A (2).txt, A (3).txt, A (4).txt`


- Hence, the standard convention employed by most file systems that is; “space, parentheses open, number, parentheses close”  for example (5) is used.
- The number within the parenthesis is a sequential calculated by increamenting until it constitutes a unique `downloadName` within the destination namespace or folder.
- If an incoming file of folder has a dedube string that can lead to recursive contecationation, the existing dedupe string is updated to until it is unique. For example say an incoming file has name `A (1).txt` if there were already two files both named `A.txt` then one would have the download name `A (1).txt` implying that the unique download name for the incomding file should predictively be `A (1) (1).txt`. However, multiple deduplication strings would be avoided and the number in the last pathensis closest to the extension would be updated. Conclusively, the incoming file `A (1).txt` in the stated example would assume a download name such as `A (1+n).txt` instead of `A (1)(1).txt` and subsequently or arrangements like `A (1)(1)(1).txt | A (2)(3)(1).txt` ....

### Algorithm


* **1: IF SIBLINGS :** check for conflicts
* **2: IF NO CONFLICT :** The `downloadName = displayName + fileExtension` or simply  `downloadName = displayName` in the case of folder.
* **3: IF CONFLICT:** The` downloadName = displayName (fileId) + fileExtension`

**Notes:**

* Name collisions should be checked across record and folder tables
* [Extensions in folder names matter](https://apple.stackexchange.com/questions/123001/renamed-folder-becomes-a-file-with-an-extension) and should be handled :
* Case sensitivity is taken into account. `Myfile` and `myFile` are different for example. That is useful to [ensure complete syncs](https://rclone.org/overview/#case-insensitive).

#### Extensions

For both files and folders the extension is any string that follows after the last dot.

For example:
<table>
   <thead>
      <th>File/Folder Name</th>
      <th>Extension</th>
      <th>Remark</th>
   </thead>
   <tbody>
      <tr>
         <td>My File.txt</td>
         <td>txt</td>
         <td>Regular</td>
      </tr>
      <tr>
         <td>My File.txt(1)</td>
         <td>txt(1)</td>
         <td>Extension contains non-alphanumeric chars</td>
      </tr>
      <tr>
         <td>My File.app</td>
         <td>app</td>
         <td>Regular</td>
      </tr>
      <tr>
         <td>something.something</td>
         <td>something</td>
         <td>Name same as extension</td>
      </tr>
      <tr>
         <td>2022.03.02</td>
         <td>02</td>
         <td>Extension is number</td>
      </tr>
      <tr>
         <td>Folder.Work Files</td>
         <td>Work Files</td>
         <td>Extension contains spaces</td>
      </tr>
   </tbody>
</table>

As seen, extension can take infinite number of "shapes" BUT as long as all characters in the file name including the extension are valid file name chacters, then, **the extension is the string tha follows after the last dot** (Emphasis).


### Reserved/unsupported characters

Characters that do not map to various file systems would be encoded. For example, `/` is not allowed in file names in all operating systems, while Windows goes ahead to restrict a lot more characters including `*`, `<`, `>`, `/`, `:`, `"` and `|`. 

#### References for reserved characters. 

* [Path Naming Conventions](https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file)
* [Reserved Characters](https://en.wikipedia.org/wiki/Filename#Reserved_characters_and_words)

_What each unsupported character encodes to has to ultimately be decided and the reference table developed if neccesary._


## Example 

**Folders**


<table>
  <tr>
   <td><strong>Folder ID</strong>
   </td>
   <td><strong>Folder Name</strong>
   </td>
  </tr>
  <tr>
   <td>1
   </td>
   <td>Documents
   </td>
  </tr>
  <tr>
   <td>2
   </td>
   <td>Projects
   </td>
  </tr>
  <tr>
   <td>3
   </td>
   <td>Others
   </td>
  </tr>
</table>


**Files and expected downloadNames**

<table>
  <tr>
   <td><strong>ID</strong>
   </td>
   <td><strong>Folder ID</strong>
   </td>
   <td><strong>Original File/Folder Name (as uploaded/created)</strong>
   </td>
   <td><strong>Conflict? </strong>
   </td>
   <td><strong>Type</strong>
   </td>
   <td><strong>downloadFileName </strong>or <strong>downloadFolderName</strong>
   </td>
  </tr>
  <tr>
   <td>1
   </td>
   <td>1
   </td>
   <td>Resume.docx
   </td>
   <td>NO
   </td>
   <td>File
   </td>
   <td>Resume.docx
   </td>
  </tr>
  <tr>
   <td>2
   </td>
   <td>1
   </td>
   <td>Resume.pdf
   </td>
   <td>NO
   </td>
   <td>File
   </td>
   <td>Resume.pdf
   </td>
  </tr>
  <tr>
   <td>3
   </td>
   <td>2
   </td>
   <td>Resume.docx
   </td>
   <td>NO
   </td>
   <td>File
   </td>
   <td>Resume.pdf
   </td>
  </tr>
  <tr>
   <td>4
   </td>
   <td>1
   </td>
   <td>Resume.pdf
   </td>
   <td>YES
   </td>
   <td>File
   </td>
   <td>Resume (1).pdf
   </td>
  </tr>
  <tr>
   <td>5
   </td>
   <td>1
   </td>
   <td>Resume (1).pdf
   </td>
   <td>YES (in downloadName)
   </td>
   <td>File
   </td>
   <td>Resume (2).pdf
   </td>
  </tr>
  <tr>
   <td>6
   </td>
   <td>3
   </td>
   <td>Resume.pdf
   </td>
   <td>NO
   </td>
   <td>File
   </td>
   <td>Resume.pdf
   </td>
  </tr>
  <tr>
   <td>7
   </td>
   <td>3
   </td>
   <td>Photos
   </td>
   <td>NO
   </td>
   <td>Folder
   </td>
   <td>Photos
   </td>
  </tr>
  <tr>
   <td>8
   </td>
   <td>3
   </td>
   <td>Photos
   </td>
   <td>YES
   </td>
   <td>File
   </td>
   <td>Photos (1)
   </td>
  </tr>
  <tr>
   <td>9
   </td>
   <td>1
   </td>
   <td>Resume.pdf
   </td>
   <td>YES
   </td>
   <td>File
   </td>
   <td>Resume (3).pdf
   </td>
  </tr>
  <tr>
   <td>10
   </td>
   <td>1
   </td>
   <td>Certifications
   </td>
   <td>NO
   </td>
   <td>Folder
   </td>
   <td>Certifications
   </td>
  </tr>
  <tr>
   <td>11
   </td>
   <td>2
   </td>
   <td>Photos
   </td>
   <td>NO
   </td>
   <td>Folder
   </td>
   <td>Photos
   </td>
  </tr>
  <tr>
   <td>12
   </td>
   <td>2
   </td>
   <td>Photos
   </td>
   <td>YES
   </td>
   <td>Folder
   </td>
   <td>Photos (1)
   </td>
  </tr>
  <tr>
   <td>13
   </td>
   <td>1
   </td>
   <td>Resume.pdf
   </td>
   <td>YES
   </td>
   <td>File
   </td>
   <td>Resume (4).pdf
   </td>
  </tr>
  <tr>
   <td>14
   </td>
   <td>1
   </td>
   <td>Certifications
   </td>
   <td>YES
   </td>
   <td>Folder
   </td>
   <td>Certifications (1)
   </td>
  </tr>
  <tr>
   <td>15
   </td>
   <td>1
   </td>
   <td>Certifications_1
   </td>
   <td>NO
   </td>
   <td>Folder
   </td>
   <td>Certifications_1 (1)
   </td>
  </tr>
  <tr>
   <td>16
   </td>
   <td>2
   </td>
   <td>Certifications
   </td>
   <td>NO
   </td>
   <td>Folder
   </td>
   <td>Certifications
   </td>
  </tr>
  <tr>
   <td>17
   </td>
   <td>3
   </td>
   <td>Photos
   </td>
   <td>YES
   </td>
   <td>Folder
   </td>
   <td>Photos (2)
   </td>
  </tr>
</table>



## Implementation Plan

1. Populate the downloadFileName field in the record table upon file upload with a unique name that is either the uploadFileName or resembles it. To ensure uniqueness, the value of this field will be dependent on the downloadFileName of other files that have the same parent folder.
2. Create a new field downloadFolderName in the folder table and populate it with same rules as in #1.
3. Once #1 and #2 is rolled out to production and confirmed to be working, write a script that will be run one time to populate the value of downloadFileName & downloadFolderName for all records that were created prior to the implementation of #1 and #2.

NB: downloadFileName & downloadFolderName **should be recalculated after file or folder rename.**


## Status


<table>
  <tr>
   <td>Implementation Plan Step
   </td>
   <td>Status
   </td>
   <td> REFERENCE
   </td>
  </tr>
  <tr>
   <td>1
   </td>
   <td><strong>In progress</strong>
   </td>
   <td><a href="https://github.com/PermanentOrg/back-end/pull/40">https://github.com/PermanentOrg/back-end/pull/40</a>
   </td>
  </tr>
  <tr>
   <td>2
   </td>
   <td><strong>In progress</strong>
   </td>
   <td><a href="https://github.com/PermanentOrg/back-end/pull/40">https://github.com/PermanentOrg/back-end/pull/40</a>
   </td>
  </tr>
  <tr>
   <td>3
   </td>
   <td><strong>Pending 1 & 2</strong>
   </td>
   <td>
   </td>
  </tr>
</table>


## Testing Plan

- Test generates directory-unique & correctly formatted `downloadName` for n colliding files in the same namespace (parent folder).
- Test generates directory-unique & correctly formatted `downloadName` for n colliding folders in the same namespace.
- Test generates directory-unique & correctly formatted `downloadName` for n colliding files & folders in the same namespace.
- Test generates directory-unique & correctly formatted `downloadName` for incoming files and folders holding colliding deduplication strings.
- Test generates directory-unique & correctly formatted `downloadName` for files and folders with uncommon naming styles.

*Directory-unique: Download names need be unique only for files and folders in thesame directory*


# Synchronization


## Scenario Table Summary

In this case “empty” means containing no files or folders

Note that Permanent’s root directory will never be “empty” for the purposes of this table because we will always have a “virtual” permanent file structure defined in the root folder.  For instance all archives could / would be stored in a “/Archives” directory and therefore “/” is not empty.


<table>
  <tr>
   <td>
   </td>
   <td><strong>Source</strong>
   </td>
   <td><strong>Destination</strong>
   </td>
   <td><strong>Algorithm</strong>
   </td>
   <td><strong>Outcome</strong>
   </td>
  </tr>
  <tr>
   <td><strong>A</strong>
   </td>
   <td>Local (empty)
   </td>
   <td>Permanent (empty)
   </td>
   <td>Nothing happens, they’re both empty
   </td>
   <td>No change
   </td>
  </tr>
  <tr>
   <td><strong>B</strong>
   </td>
   <td>Local (populated)
   </td>
   <td>Permanent (empty)
   </td>
   <td>Normal upload of all files and folders.
   </td>
   <td>Permanent now has records for individual files and folders, containing the exact content on local.
   </td>
  </tr>
  <tr>
   <td><strong>C</strong>
   </td>
   <td>Local (empty)
   </td>
   <td>Permanent (populated)
   </td>
   <td>Depending on the command used in rclone (sync vs copy), this will either:
<p>
`copy`: Do nothing.
<p>
`sync`: Delete all content of the permanent.
   </td>
   <td>`copy`: no change
<p>
`sync`: permanent destination is now empty.
   </td>
  </tr>
  <tr>
   <td><strong>D</strong>
   </td>
   <td>Local (populated)
   </td>
   <td>Permanent (populated)
   </td>
   <td>Depending on the command used in rclone (sync vs copy), this will either:
<p>
`copy`: Upload content for each file that has a difference (determined by rclone)
<p>
`sync`: Upload content for each file with a difference, delete any files or folders that don’t exist locally.
<p>
<em>Note: that file destination paths are deterministic / all “duplicate” file names on the Permanent end had already been resolved by the dedupe naming algorithm described earlier in this document.</em>
   </td>
   <td>`copy`: all files that exist on local now exist on Permanent, and the content matches exactly.  However, files on Permanent that don’t exist on local have not been modified
<p>
`sync`: permanent destination now matches the local source exactly: the same files, the same content.
   </td>
  </tr>
  <tr>
   <td><strong>E</strong>
   </td>
   <td>Permanent (empty)
   </td>
   <td>Local (empty)
   </td>
   <td>Nothing happens, they’re both empty
   </td>
   <td>No change
   </td>
  </tr>
  <tr>
   <td><strong>F</strong>
   </td>
   <td>Permanent (empty)
   </td>
   <td>Local (populated)
   </td>
   <td>Depending on the command used in rclone (sync vs copy), this will either:
<p>
`copy`: Do nothing.
<p>
`sync`: Delete all content of the local directory.
   </td>
   <td>`copy`: no change
<p>
`sync`: local destination is now empty.
   </td>
  </tr>
  <tr>
   <td><strong>G</strong>
   </td>
   <td>Permanent (populated)
   </td>
   <td>Local (empty)
   </td>
   <td>Normal download of all files and folders.
   </td>
   <td>Local now has copies of each file and folder containing the same content as Permanent.
<p>
<em>Note: the names of files and folders are determined by the “dedupe” algorithm described earlier in this document.</em>
   </td>
  </tr>
  <tr>
   <td><strong>H</strong>
   </td>
   <td>Permanent (populated)
   </td>
   <td>Local (populated)
   </td>
   <td>Depending on the command used in rclone (sync vs copy), this will either:
<p>
`copy`: Download content for each file that has a difference (determined by rclone)
<p>
`sync`: Download content for each file with a difference, delete any files or folders that don’t exist on the Permanent source.
<p>
<em>Note: that file destination paths are deterministic / all “duplicate” file names on the Permanent end had already been resolved by the dedupe naming algorithm described earlier in this document.</em>
   </td>
   <td>`copy`: all files that exist on Permanent now exist on the local filesystem, and the content matches exactly.  However, files on the local filesystem that don’t exist on Permanent have not been modified.
<p>
`sync`: local filesystem now matches the Permanent source exactly: the same files, the same content.
   </td>
  </tr>
</table>


## Deletion Risks

We want to make sure that users understand the difference between a **sync** and a **copy**. Those two commands mean different things in rclone:


* **“sync”** is more destructive because it can delete files.  For example syncing an empty local folder with a populated Permanent archive would lead to the complete deletion of the archive which may not be what the user expected. Hence the buttons or whatever UI is exposed to the user for rclone interaction must provide the appropriate warning.
* **“copy”** is less destructive because it does not delete files, it either creates or overwrites.  It can still cause data modification in the case of an overwrite. For example if a file exists both locally and on Permanent but with different content.  After the copy both files would contain the same content.


## Other Notes

* [Proposal V1](https://docs.google.com/document/d/1zOFDjDQJb4A2VlbJDqqBLXw01LZwdVQYAJWsXwtcRFs/edit?usp=sharing)
* [Meeting Notes on Collisions [02-03-2022]](https://pad.opentechstrategies.com/p/permanent-2022-02-03) 
* [User Experience Notes](https://docs.google.com/document/d/13zsy2amn0AeEE_cA1gkZ9vM77acY3f3nxEkA7Rvox_g/edit?usp=sharing)