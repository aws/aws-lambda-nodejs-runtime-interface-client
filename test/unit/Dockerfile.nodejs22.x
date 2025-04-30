FROM node:22
RUN apt-get update
RUN apt-get install -y cmake
WORKDIR /tmp
COPY . /tmp
RUN npm install --ci
CMD ["npm", "run", "test"]
