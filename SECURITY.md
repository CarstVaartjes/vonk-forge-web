# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub. Open the
repository's **Security** tab and choose **Report a vulnerability**
(<https://github.com/CarstVaartjes/vonk-forge-web/security/advisories/new>). Do not put
the details in a public issue, pull request or discussion.

If the form is not available, open a public issue titled "Security contact
request" with no details. The maintainer then opens a private advisory with
you.

## Supported versions

Only the live site, deployed from `main`, is supported. There are no versioned
releases to patch.

## Scope

The `vonkforge.ai` site and its build: the static pages, the recipe catalog
verification in the Pages build, and the deployment workflow. Problems in the
Controller, the agent or `vonkctl` belong in
[vonk-forge](https://github.com/CarstVaartjes/vonk-forge/security), and
problems in a recipe in
[vonk-forge-recipes](https://github.com/CarstVaartjes/vonk-forge-recipes/security).
