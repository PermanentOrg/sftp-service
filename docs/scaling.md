# Thoughts on Scaling

The SFTP service currently leverages the following computational resources which, if limited, could impact usability:

1. Network bandwidth
2. Network connections
3. Temporary storage
4. Memory
5. Permanent back-end performance

## Resource Types

### Network Bandwidth

Network bandwidth will most affect the following SFTP operations:

1. `SSH_FXP_READ`
2. `SSH_FXP_WRITE`

Other SFTP operations still use the network, but are generally going to be communicating smaller numbers of bytes (e.g. status codes, file names, or file attribute strings).

In an HTTP context we would not face this issue -- a given file could be read from (or written to) S3 directly through the use of presigned urls.
SFTP as a protocol does not support anything like this, and as a result when our service receives a READ it must respond with data, and when it receives a WRITE it must accept that data.

When a `READ` operation occurs, some amount of data is read from S3 by the SFTP service into local memory, and then sent to the client.
When a `WRITE` operation occurs, some amount of data is sent to the SFTP service from the client.

#### Paths for improvement

1. Deploy to EC2 instances that are designed for high bandwidth. There is an article about [Amazon EC2 instance network bandwidth](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-network-bandwidth.html) with more information.
2. Multiple instances + load balancing. Since this is not an HTTP service load balancing would be performed through a [Network Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html). I'll talk in more

### Network Connections

There should not be any issues related to network connections.

There was a brief period of time when I was worried some of our latency bugs were related to the saturation of a connection pool, but my understanding is that node's default settings put no limits on the number of active http requests or client connections.

### Temporary Storage

The SFTP protocol does not provide the total size of a file that is being uploaded; this means we cannot know the size of an uploaded file until a `SSH_FXP_CLOSE` has been called. Permanent, however, uses S3 presigned posts and requires a max file size in order to generate a presigned post. The result is that we have to somehow "buffer" the file until it is closed, and only after the close happens can we upload the file to Permanent.

We are currently using local file storage for that buffer. This is a problem because we can run out of local disk space (e.g. if the total amount of "in process" data across all SFTP clients is greater than the file system then all clients will be told there is no more disk space. The current implementation is not just a scalability problem, but a security problem as well since it exposes the service to a fairly easy to execute DOS attack (simply uploading a single file that is too large would cause the service to stop working for all users!).

#### Paths for improvement

1. Write temporary files to S3 -- this would allow our service to avoid any DOS risks. We would likely want to also implement some kinds of limits to concurrent upload amounts for a given user to prevent risk of unlimited costs (e.g. a user uploading 100 TB of data to S3 in a single file).
2. Increase the size of the local file system -- this would not protect from a DOS attack, but it would make the issue less likely to manifest for regular use.

### Memory

We are not currently leaning on memory for file data, so I do not expect memory limitations to be an issue.

### Permanent back-end performance

This is likely the most significant limitation for the SFTP service's performance:

1. Each SFTP action translates to multiple API / network calls.
2. Each upload will not resolve until Permanent has finished processing the upload.

The upload processing times, in particular, means that transferring a thousand small files is likely to take much longer than it would for an SFTP service rooted in a normal filesystem.

#### Paths for improvement

1. Update the permanent backend to provide the necessary metadata / original file access instantaneously after a record is registered, rather than waiting until the processing pipeline to resolve.

It's also possible we could augment the virtual filesystem to work against some kind of "staging" location for data in addition to the permanent API (e.g. a file is uploaded to S3 directly, and sits there for the purposes of SFTP until it has been completely processed). This would be a much more complicated solution.

## Load Balancing

The current system lends itself to having multiple copies running simultaneously, as each instance is ultimately acting as the mediator between the SFTP client and the permanent backend. That said, there are some considerations:

1. Caching - This may not be an issue at all, as the current cache is implemented in a way that will re-look-up in the event of a false positive, and most direct lookups bypass the cache. That said, it should at least be thought about!

2. Concurrent upload limits - Any potential limits on concurrent upload file sizes will be harder to monitor in a multi-instance scenario (since each instance would not necessarily know what uploads are happening for the same user on other instances).
