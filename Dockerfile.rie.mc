FROM public.ecr.aws/lambda/nodejs:24-preview

# Copy MC RIE
RUN mkdir -p /usr/local/bin/
COPY bin/aws-lambda-rie /usr/local/bin/
RUN chmod +x /usr/local/bin/aws-lambda-rie

# Swap RIC
ADD build-artifacts/aws-lambda-ric-*.tgz /tmp/
RUN mv /tmp/package/* /var/runtime/ && rm -rf /tmp/package

# Inject task
ENV LAMBDA_TASK_ROOT="/var/task"
COPY resources/index.cjs /var/task/
ENV _HANDLER="index.handler"

# Set runtime API for local testing
ENV AWS_LAMBDA_MAX_CONCURRENCY="2"
ENV AWS_LAMBDA_NODEJS_WORKER_COUNT="8"

# Enable Verbose log
ENV AWS_LAMBDA_RUNTIME_VERBOSE="1"

ENTRYPOINT ["/usr/local/bin/aws-lambda-rie"]
CMD ["/var/runtime/bootstrap"]
