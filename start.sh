docker rm -f contracts
docker build -t marlin .
# sleep 5
docker rmi -f `docker images -f "dangling=true" -q`
docker run -p8545:8545 -v ${PWD}:/home/app -d --name=contracts marlin
# docker run -d --name=contracts marlin
docker exec -it contracts bash