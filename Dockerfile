FROM node:latest
RUN mkdir -p /usr/src/cvs-tsk-cert-gen
WORKDIR /usr/src/cvs-tsk-cert-gen

ENV AWS_ACCESS_KEY_ID=accessKey1
ENV AWS_SECRET_ACCESS_KEY=verySecretKey1

# Copy source & tests
COPY src /usr/src/cvs-tsk-cert-gen/src
COPY tests/resources /usr/src/cvs-tsk-cert-gen/tests/resources

# Copy configuration & npm files
COPY tsconfig.json /usr/src/cvs-tsk-cert-gen
COPY tslint.json /usr/src/cvs-tsk-cert-gen
COPY serverless.yml /usr/src/cvs-tsk-cert-gen
COPY src/config /usr/src/cvs-tsk-cert-gen/.build/src/config
COPY package.json /usr/src/cvs-tsk-cert-gen
COPY package-lock.json /usr/src/cvs-tsk-cert-gen

# Copy signatures
COPY tests/resources/signatures /usr/src/cvs-tsk-cert-gen/signatures

# Install dependencies
RUN npm install
RUN apt-get update && \
    apt-get install -y \
        python \
        python-dev \
        python-pip \
        python-setuptools \
        groff \
        less \
    && pip install --upgrade awscli \
    && apt-get clean

## Script from the web to wait for S3 to start up
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.2.1/wait /wait
RUN chmod +x /wait

## Run the wait script until SQS is up
## Create buckets and add the signature
## Start
CMD /wait && \
aws --endpoint-url=http://s3:7000 s3 mb s3://cvs-cert && \
aws --endpoint-url=http://s3:7000 s3 mb s3://cvs-signature && \
echo "Adding signatures" && \
aws s3api put-object --endpoint-url=http://s3:7000 --bucket cvs-signature --key 1.base64 --body /usr/src/cvs-tsk-cert-gen/signatures/1.base64 && \
npm start
