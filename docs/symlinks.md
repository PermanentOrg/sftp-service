# Handling Symlinks

## Symlinks are ignored

Most file systems support [**symbolic links** (symlinks)](https://en.wikipedia.org/wiki/Symbolic_link) which are essentially files which refer to other files. Even though `rclone` [has a way to support](https://rclone.org/local/#symlinks-junction-points) `symlinks`, **Permanent and its `sftp-service` which talks to `rclone` does not support `symlinks`.**

The consequence or expected behavior is that during `copy` or `sync` operations `symlinks` are simply ignored.
