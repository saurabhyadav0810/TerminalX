pipeline {
    agent any

    stages {

        stage('Clone Repository') {
            steps {
                git branch: 'main',
                url: 'https://github.com/saurabhyadav0810/TerminalX.git'
            }
        }

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
                    bat 'docker stop terminalx-container || exit 0'
                    bat 'docker rm terminalx-container || exit 0'
                }
            }
        }

        stage('Run Container') {
            steps {
                script {
                    bat '''
                    docker run -d ^
                    --name terminalx-container ^
                    -p 3000:3000 ^
                    terminalx
                    '''
                }
            }
        }
    }
}