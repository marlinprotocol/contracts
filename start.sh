docker rm -f contracts
docker build -t marlin .
docker rmi -f `docker images -f "dangling=true" -q`
docker run -d --name=contracts marlin
docker exec -it contracts bash
