---
name: Bug report
about: Create a report to help us improve
title: ''
labels: ''
assignees: ''

---

**Note:** Please always try reproducing the issue on the `:edge` build. There is a chance that it was already fixed. If it's an UI issue, you can try reporducing it on the [demo page](https://pigallery2.onrender.com/). 

----------------------------------------------------------------------------------

**Describe the bug**

A clear and concise description of what the bug is.
Also how to reproduce, the expected behavior.

**Photo/video (optional) that causes the bug**

If error is in connection with a particular photo/video, It would help a lot with the debugging if you can attach that file too.

**Screenshots (optional)**

If applicable, add screenshots to help explain your problem.

**Server logs (optional)**

In case of a server side error, provide logs:
* Set env variable `NODE_ENV=debug` to log everything.
* To get logs from docker: `docker ps -a` to list containers, `docker logs <container ID>` to get logs.

**Environment (please complete the following information):**
 - OS: [e.g. server runs on linux, browser on windows]
 - Browser [e.g. chrome, safari]

**Used app version**:
- compiled from source
- docker-edge
- docker-vXX
- release vXX
- ect...
