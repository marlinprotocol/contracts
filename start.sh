docker rm -f contracts
docker build -t marlin .
docker rmi -f `docker images -f "dangling=true" -q`
docker run -v ${PWD}:/home/app -d --name=contracts marlin
docker exec -it contracts bash