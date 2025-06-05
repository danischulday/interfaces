const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const waitingUsers = [];

io.on('connection', (socket) => {
    console.log('Conectado:', socket.id);

    // Agregar socket a la lista de espera si no está
    if (!waitingUsers.includes(socket)) {
        waitingUsers.push(socket);
        tryPairRandomUsers();
    }

    // Función que empareja dos usuarios al azar
    function tryPairRandomUsers() {
        while (waitingUsers.length > 1) {
            // Elegir dos índices al azar
            const firstIndex = Math.floor(Math.random() * waitingUsers.length);
            const firstUser = waitingUsers.splice(firstIndex, 1)[0];

            const secondIndex = Math.floor(Math.random() * waitingUsers.length);
            const secondUser = waitingUsers.splice(secondIndex, 1)[0];

            firstUser.partnerId = secondUser.id;
            secondUser.partnerId = firstUser.id;

            firstUser.emit('paired', { partnerId: secondUser.id });
            secondUser.emit('paired', { partnerId: firstUser.id });
        }
    }

    socket.on('offer', (offer, to) => {
        io.to(to).emit('offer', offer, socket.id);
    });

    socket.on('answer', (answer, to) => {
        io.to(to).emit('answer', answer);
    });

    socket.on('ice-candidate', (candidate, to) => {
        io.to(to).emit('ice-candidate', candidate);
    });

    socket.on('next-call', () => {
        if (socket.partnerId) {
            io.to(socket.partnerId).emit('partner-disconnected');

            const partnerSocket = io.sockets.sockets.get(socket.partnerId);
            if (partnerSocket) partnerSocket.partnerId = null;

            socket.partnerId = null;
        }

        if (!waitingUsers.includes(socket)) waitingUsers.push(socket);

        tryPairRandomUsers();
    });

    socket.on('end-call', (to) => {
        if (to) {
            io.to(to).emit('partner-disconnected');

            const partnerSocket = io.sockets.sockets.get(to);
            if (partnerSocket) partnerSocket.partnerId = null;
        }

        socket.partnerId = null;
    });

    socket.on('disconnect', () => {
        console.log('Desconectado:', socket.id);

        // Remover de la lista de espera si estaba
        const index = waitingUsers.indexOf(socket);
        if (index !== -1) waitingUsers.splice(index, 1);

        if (socket.partnerId) {
            io.to(socket.partnerId).emit('partner-disconnected');

            const partnerSocket = io.sockets.sockets.get(socket.partnerId);
            if (partnerSocket) partnerSocket.partnerId = null;
        }
    });
});

server.listen(3000, () => {
    console.log('Servidor corriendo en http://localhost:3000');
});
