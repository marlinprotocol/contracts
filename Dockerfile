FROM node:10.15-jessie

RUN cd ~ && mkdir app
WORKDIR /home/app

RUN npm i -g truffle
RUN npm i -g ganache-cli
RUN npm install @0x/sol-compiler --g

COPY package.json /home/app/package.json
COPY package-lock.json /home/app/package-lock.json

RUN npm install
# RUN npm audit

COPY . /home/app
CMD [ "ganache-cli","-a","50"]