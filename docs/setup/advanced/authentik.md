# Authentik Setup (Optional)

If you run multiple self-hosted services, you may want **Single Sign-On (SSO)**. [Authentik](https://goauthentik.io/) is a great choice and integrates cleanly with PiGallery2 via **OpenID Connect (OIDC)**.

## Deploy Authentik

In Portainer, create a new **Stack** for Authentik. It is recommended to use the latest `docker-compose.yml` from the [official Authentik documentation](https://docs.goauthentik.io/install-config/install/docker-compose/).
![screen](assets/authentik.png)

Key configuration points for PiGallery2 integration:

- Ensure Authentik is on the `frontend` network if you want NPM to route to it internally.
- In Authentik, create a new **OAuth2/OpenID Provider**.
- Set the **Redirect URI** to: `https://photos.yourdomain.com/pgapi/auth/oidc/callback`


![screen](assets/authentik2.png)
![screen](assets/authentik3.png)
![screen](assets/authentik4.png)
![screen](assets/authentik5.png)


## Configure PiGallery2 for OIDC

In the PiGallery2 web interface, go to **Settings** -> **Users** and enable **OpenID Connect**. Use the Client ID, Client Secret, and Issuer URL provided by Authentik.

![screen](assets/authentik6.png)
