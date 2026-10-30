# Public hosting

The full app runs as one Docker container: FastAPI serves the built React frontend, the API, and uploaded photos. CLIP runs on CPU inside that container. GitHub stores the source; GitHub Pages cannot run this backend.

## Render deployment template

`render.yaml` describes a Docker web service with one 2-CPU, 4-GB instance and a 10-GB persistent disk mounted at `/data`. This is a proposed configuration, not a deployed or purchased service. Confirm Render's current compute, disk, and bandwidth pricing before creating it. No automatic deployments are enabled by the template.

Install and connect Render in this chat, or connect the GitHub repository from your Render dashboard and create a Blueprint from `render.yaml`. The repository can remain private if the connected Render GitHub integration has access to it. The hosting provider assigns the eventual public URL; none is provisioned by committing this configuration.

The Docker build installs CPU-only PyTorch, builds React, and downloads CLIP weights into the image. The persistent disk holds listing metadata, Qdrant files, and normalized upload images. Model weights live outside that disk so a new empty disk does not hide them. Startup loads CLIP before the API becomes ready, and the health check is `/api/health`.

Keep exactly one worker and one instance. Embedded Qdrant locks its directory and must not be shared across independent API processes. To scale beyond one instance, move Qdrant and photo storage to separately hosted services first.

## After deployment

1. Confirm `/api/health` returns `status: ok` and `model_loaded: true`.
2. Open the assigned HTTPS URL and post a test item.
3. Search for it using a description and a different photo.
4. Restart the service and confirm the post and photo remain available.
5. Optionally add the sample board using `.venv/bin/python -m backend.seed --api https://YOUR-ASSIGNED-HOST`.

The seed command uploads only the six predefined public stock images and sample metadata. Existing records are not deleted. Local records and model caches are not automatically uploaded to a host.

This version supports public browsing and posting without accounts. It does not verify ownership or pickup notes. Use demonstration belongings for judging; account-based posting, abuse controls, and moderation are future work.

## Generic Docker hosting

```sh
docker build -t foundit .
docker run --rm -p 8000:8000 -v foundit-data:/data foundit
```

Open http://localhost:8000. Keep the named volume to preserve records across container restarts. A hosting platform should provide HTTPS and persistent storage. Set `PORT` if the platform expects a different listener port.

## References

- [Render Blueprint configuration](https://render.com/docs/blueprint-spec)
- [Render persistent disks](https://render.com/docs/disks)
- [Render pricing](https://render.com/pricing)
