FROM node:10.15-jessie

RUN cd ~ && mkdir app
WORKDIR /home/app

RUN npm i -g truffle
RUN npm i -g ganache-cli
COPY package.json /home/app/package.json
COPY package-lock.json /home/app/package-lock.json

RUN npm install
# RUN npm i -S @openzeppelin/upgrades

COPY . /home/app
CMD [ "ganache-cli","-a","50"]