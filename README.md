# SFTP Service

This project uses NodeJS 16.x and contains an implementation of the SFTP protocol that supports interaction with the Permanent API.

## Usage

1. Install npm packages.

```
npm install
```

2. Generate a host key for your SSH server

```
ssh-keygen -f ./keys/host.key -t ed25519 -N ""
```

3. Configure your `.env`

```
cp .env.example .env
vi .env
```

4. Start the service

```
npm start
```

or, if you want to start the development environment

```
npm run dev
```

## Running [rclone](https://rclone.org) against Permanent.org instances

First install rclone.  See the [official installation
guide](https://rclone.org/install/) for more information.

### Set up an rclone remote

Run **`rclone config`** and answer the questions it asks:

- Select option **`n`** (for "new") and make a remote name (e.g., "permanent").

- At the **`Storage>`** prompt, set the storage protocol to SFTP, either by typing "sftp" at the prompt or by selecting the corresponding number from the displayed menu (the numbered entry may say "SSH/SFTP").

- At the **`host>`** prompt, set the host to **`sftp.permanent.org`**.

  If you want to run rclone against the dev or staging environment, then use `sftp.dev.permanent.org` or `sftp.staging.permanent.org` instead.

- At the **`user>`** prompt, enter your Permanent username, which is the email address associated with your account.

  You might see "SSH username" above the prompt and be tempted to enter your usual SSH username here (if you use SSH regularly).  But in this context, the "SSH" just refers to the fact that we run the SFTP storage protocol over SSH for a secure connection, so the relevant username is the one for your Permanent account.

- At the **`port>`** prompt, enter **`22`** (or just hit Enter, since 22 is the default).

- At the **`y/g/n>`** prompt for how you'll enter your Permanent password, choose **`y`** for "Yes, type in my own password".

  You will then be prompted to enter the password for your Permanent account.  

  Note that this password will be stored in a local file, and it will be in lightly obscured form but _not_ securely encrypted.  If you'd rather not have the password stored locally that way, there are two solutions available:

    - Set the environment variable `RCLONE_CONFIG_PASS` to some passphrase, which will be used to symmetrically encrypt/decrypt your Permanent password in your local rclone configuration file.

       *-or-*

    - Later on, when asked whether to *"Edit advanced config?"*, answer **`y`** instead of **`n`**.  Then when you get to the `ask_password>` option, enter "true" (and for all the other prompts in the advanced config section, just hit Enter to accept the default).

- For the remaining options, just choose the default by pressing Enter:
    - `key_pem>`
    - `key_file>`
    - `y/g/n>` for option `key_file_pass` -- just hit Enter for default `n`
    - `pubkey_file>` 
    - `key_use_agent>`
    - `use_insecure_cipher>` 
    - `disable_hashcheck>`
    - `y/n>` for option `Edit advanced config?` -- just hit Enter for `n` (unless you're doing the `ask_password` option as described earlier)

- At the **`y/e/d>`** prompt, when rclone shows you your completed configuration, hit Enter (same as `y`) to keep the new configuration.

- At the **`e/n/d/r/c/s/q>`** prompt at the very end, hit **`q`** to quit out of configuration.

The configuration for your Permanent remote is now stored, most likely in your `rclone.conf` file.  The location of this file can differ from system to system (on some Linux-based systems it's in `~/.config/rclone/rclone.conf`), but rclone knows where to find it.

If you chose to have your password stored in the config file, then your `rclone.conf` now contains a block like this:

```
[permanent]
type = sftp
host = sftp.permanent.org
user = your@email.address
pass = 5PfZmfI1qOPUiRvWgJJuZbztXq9g0nUpFxzVEPLB3fV-q86iZR7FtXQ--X6hUe559dM
```

Or you chose to have rclone ask you for your password on each invocation, then your `rclone.conf` instead contains a block like this:

```
[permanent]
type = sftp
host = sftp.permanent.org
user = your@email.address
ask_password = true
```

In the latter case, you could of course just set up the `rclone.conf` file manually yourself, and skip the `rclone config` questionnaire entirely.

### Run `rclone` commands to send data to and from Permanent.

In both uploading and downloading, we recommend using the `--create-empty-src-dirs` flag; otherwise `rclone` will ignore empty directories on the source side of an operation.

You might also consider using one or both of `-v` (verbose) and `-P` (show an in-place updating progress meter) to see what `rclone` is doing.  See [rclone.org/flags](https://rclone.org/flags/) for a list of all global flags (that is, flags that are available to every subcommand).

#### Downloading from Permanent:

To fetch all of your archives, use command like this:

```
     rclone copy --create-empty-src-dirs --size-only permanent:/ ./my-permanent-data
```

To fetch a particular archive, use command like the one below.  Note that you'll need the archive's number as well as its name -- the number goes in parentheses after the name, e.g., the "(12345)" below.  Right now, the only way find out an archive's number is to download all your archives and look for that number in parentheses among the names of the downloaded folders, or to ask a Permanent engineer if you happen to know one.  This is a known problem; see [issue #91](https://github.com/PermanentOrg/sftp-service/issues/91) for details.  Anyway, assuming you have found out the archive's number, you can fetch just that archive like so:

```
     rclone copy -v -P --create-empty-src-dirs "permanent-prod:/archives/Some Archive (12345)/My Files/" ./some-archive
```

See [rclone.org/commands/rclone_copy](https://rclone.org/commands/rclone_copy/) for other flags to the `copy` subcommand.

#### Uploading to Permanent:

To send data to Permanent, just reverse the order of operands: your local file tree is now the source and Permanent is the destination.  You'll also need to add the `--size-only` and `--sftp-set-modtime=false` flags (currently necessary because of [issue #80](https://github.com/PermanentOrg/sftp-service/issues/80)).  Here's an example command:

```
     rclone copy -v -P --create-empty-src-dirs --size-only --sftp-set-modtime=false ./some-archive "permanent-prod:/archives/Some Archive (12345)/My Files/"
```

### Troubleshooting rclone

- MFA / 2FA authentication prevents rclone from working.

  Because rclone does not support multi-factor authentication, you must turn off MFA in your Permanent account before transferring data with rclone.  (Note thaht there might be other SFTP clients that can handle MFA; this documentation is only about rclone.)

- Empty directories are not copied down when cloning from Permanent.

  By default, rclone (over SFTP) does not copy empty directories down.  However, if you pass the `--create-empty-src-dirs` flag, empty directories will be included.  For example: `rclone copy --create-empty-src-dirs permanent:/ my-permanent-data`.

## Contributing

Contributors to this repository agree to adhere to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). To report violations, get in touch with engineers@permanent.org.

## Security

Found a vulnerability? Report this and any other security concerns to engineers@permanent.org.

## Generating a Token

Right now this project uses a bearer token which must be generated by a permanent dev for testing purposes.

If you're a permanent dev, here are the steps:

1. Get the FusionAuth client and secret.
2. Log into the demo user at the [sftp local app](https://permanent-dev.fusionauth.io/oauth2/authorize?client_id=53c713d5-ba07-472f-a79b-582767ff6d84&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A9000%2Fauth%2Fcallback)
3. In the URL extract the `code` value
4. POST to https://permanent-dev.fusionauth.io/oauth2/token with the following x-www-form-urlencoded body:

```
client_id: ????
client_secret: ????
code: ????
grant_type: authorization_code
redirect_uri: http://localhost:9000/auth/callback
```

## License

This code is free software licensed as [AGPLv3](LICENSE), or at your option, any final, later version published by the Free Software Foundation.
