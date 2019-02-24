# cvs-tsk-cert-gen

### Prerequisites
- NodeJS 8.10
- Typescript - `npm install -g typescript`
- Serverless - `npm install -g serverless`
- Docker

### Installing
- Install dependencies - `npm install`

### Building
- Building with source maps - `npm run build:dev`
- Building without source maps - `npm run build`

### Running
- The app can be started by running `npm run start:docker`.

### Configuration
The configuration file can be found under `src/config/config.yml`.
Environment variable injection is possible with the syntax:
`${BRANCH}`, or you can specify a default value: `${BRANCH:local}`.

#### SQS
SQS contains configuration for the local environment or the AWS environment. Locally, you need to provide the `localhost` region and the SQS endpoint, which in this case is the address of a docker image. `apiVersion` and `queueName` need to be provided for both environments.
```
sqs:
  local:
    params:
      region: localhost
      endpoint: http://sqs:9324
      apiVersion: "2012-11-05"
    queueName: cert-gen-q
  remote:
    params:
      apiVersion: "2012-11-05"
    queueName: cert-gen-q
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
