FROM python:latest

ENV AWS_ACCESS_KEY_ID=accessKey1
ENV AWS_SECRET_ACCESS_KEY=verySecretKey1
ENV AWS_DEFAULT_REGION=us-east-1

# Copy signatures
COPY tests/resources/signatures /usr/src/cvs-tsk-cert-gen/signatures

# Install dependencies
RUN pip install --upgrade awscli \
    && apt-get clean

## Script from the web to wait for S3 to start up
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.2.1/wait /wait
RUN chmod +x /wait


## Run the wait script until SQS is up
## Create buckets and add the signature
## Start
CMD /wait && \
aws --endpoint-url=http://s3-cert:7000 s3 mb s3://cvs-cert && \
aws --endpoint-url=http://s3-signature:7001 s3 mb s3://cvs-signature && \
echo "Adding signatures" && \
aws s3api put-object --endpoint-url=http://s3-signature:7001 --bucket cvs-signature --key 1.base64 --body /usr/src/cvs-tsk-cert-gen/signatures/1.base64
