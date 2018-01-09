# Retagger

A simple mp3 tagging tool.

## Install

As this repository isn't currently published to npm, you have to install it manually.

    git clone https://github.com/lSoleyl/retagger.git
    npm link

## Usage

Navigate to the directory in which the mp3 files lie and execute the following command: `retagger [--help] [--test]`. The script will search recursively for all `*.mp3` files and process their tags. It will only print out the files, which need change to match the prefedined scheme.

`--help` will display a short usage message.

The `--test` switch will only display all changes, which the tool would make the the file's tags, but won't actually modify the files.
Without this switch all files will be directly modified.

## Applied changes

### Artists & Title
The script supports one of the following naming schemes for files:
 * `<artist1>&<artist2> - <title>` (spaces between the seperator and artist are allowed)
 * `<artist1>,<artist2> - <title>` (spaces between the seperator and artist are allowed)
 * `<artist1> ft. <artist2> - <title>` (ft. can also be written as feat)
 * `<artist> - <title>`
 * `<title>` (default match if no other pattern matches)

To make sure a set of files matches the scheme, `retagger --test` should be run to check how the filenames have been interpreted.

### Album
The album is set to the basename of the directory, the file is in. (Eg. `/home/music/playback/test.mp3` -> `playback`)


## Limitations

The tool currently only supports files with id3 tags of versions 2.3 and 2.4. Other versions aren't supported. The underlying library has currently no support for features like frame compression or frame encryption.
