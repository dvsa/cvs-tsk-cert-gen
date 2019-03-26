 # cvs-tsk-cert-gen

### Prerequisites
- NodeJS 8.10
- Typescript - `npm install -g typescript`
- Serverless - `npm install -g serverless`
- Docker

### Installing
- Install dependencies - `npm install`

### Building
- Building the docker image - `npm run build:docker`
- Building with source maps - `npm run build:dev`
- Building without source maps - `npm run build`

### Running
- The S3 server can be started by running `npm run start:docker`.
- The app can be started by running `npm run start`

### Configuration
The configuration file can be found under `src/config/config.yml`.
Environment variable injection is possible with the syntax:
`${BRANCH}`, or you can specify a default value: `${BRANCH:local}`.

#### Lambda Invoke
The `invoke` configuration contains settings for both the `local` and the `remote` environment.
The local environment contains configuration for the Lambda Invoke local endpoint, as well as configuration for loading mock JSON response.
```
invoke:
  local:
    params:
      apiVersion: 2015-03-31
      endpoint: http://localhost:3000
    functions:
      testResults:
          name: cvs-svc-test-results
          mock: tests/resources/test-results-response.json
      techRecords:
          name: cvs-svc-technical-records
          mock: tests/resources/tech-records-response.json
  remote:
    params:
      apiVersion: 2015-03-31
    functions:
      testResults:
          name: test-results-${BRANCH}
      techRecords:
          name: technical-records-${BRANCH}
```
#### S3
The S3 configuration contains settings for both the `local` and the `remote` environment. The `local` environment contains configuration for the local S3 instance. The `remote` environment does not require parameters.
```
s3:
  local:
    endpoint: http://localhost:7000
    s3ForcePathStyle: true
  remote: {}
```
#### MOT
The MOT configuration contains the certificate generation endpoint URL and the expected document names. For more information, please visit the [Confluence page](https://wiki.i-env.net/display/MP/Document+Generation+Service+Contract)
```
mot:
  endpoint: https://9fjfatqw19.execute-api.eu-west-1.amazonaws.com/cvs-dev/CVS
  documentNames:
    vt20: VT20.pdf
    vt20w: VT20W.pdf
    vt30: VT30.pdf
    vt30w: VT30W.pdf
    vt32ve: VT32VE.pdf
    vt32vew: VT32VEW.pdf
    prs: PRS.pdf
    prsw: PRSW.pdf
    ct20: CT20.pdf
    ct30: CT30.pdf
    vtp20: VTP20.pdf
    vtp30: VTP30.pdf
    psv_prs: PSV_PRS.pdf
    vtg5: VTG5.pdf
    vtg5a: VTG5A.pdf
```
#### Secrets
The `secrets.yml` file needs to be injected at deployment time, and should contain the API key for the MOT service.
```
mot:
  api_key: [API_KEY_HERE]
```

### Git Hooks

Please set up the following prepush git hook in .git/hooks/pre-push

```
#!/bin/sh
npm run prepush && git log -p | scanrepo

```

#### Security

Please install and run the following securiy programs as part of your testing process:

https://github.com/awslabs/git-secrets

- After installing, do a one-time set up with `git secrets --register-aws`. Run with `git secrets --scan`.

https://github.com/UKHomeOffice/repo-security-scanner

- After installing, run with `git log -p | scanrepo`.

These will be run as part of prepush so please make sure you set up the git hook above so you don't accidentally introduce any new security vulnerabilities.

### Testing
In order to test, you need to run the following:
- `npm run test` for unit tests


### Environmental variables

- The `BRANCH` environment variable indicates in which environment is this application running. Not setting this variable will result in defaulting to `local`.
