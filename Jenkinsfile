pipeline {
    agent any

    stages {

        stage('Build Docker Image') {
            steps {
                script {
                    docker.build("terminalx")
                }
            }
        }

        stage('Stop Old Container') {
            steps {
                script {
                    sh 'docker stop terminalx-container || true'
                    sh 'docker rm terminalx-container || true'
                }
            }
        }

        stage('Run Container') {
            steps {
                script {
                    sh '''
                    docker run -d \
                    --name terminalx-container \
                    -p 3000:3000 \
                    terminalx
                    '''
                }
            }
        }
    }
}