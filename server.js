require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db'); 
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get('/api', (req, res) => {
    res.json({ message: 'Backend del Hotel (MySQL) funcionando!' });
});


app.post(
    '/api/contact',
    [ 
        body('nombre', 'El nombre es requerido').notEmpty().trim().escape(),
        body('email', 'Ingresa un correo electrónico válido').isEmail().normalizeEmail(),
        body('mensaje', 'El mensaje es requerido').notEmpty().trim().escape(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { nombre, email, mensaje } = req.body;

        try {
            const sql = 'INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)';
            const [result] = await pool.query(sql, [nombre, email, mensaje]);

            console.log('Mensaje de contacto guardado, ID:', result.insertId);
            res.status(201).json({ success: true, message: 'Mensaje enviado con éxito.', data: { id: result.insertId } });
        } catch (err) {
            console.error('Error al guardar contacto:', err.code, err.message);
            res.status(500).json({ success: false, message: 'Error del servidor al procesar el mensaje.' });
        }
    }
);


app.post(
    '/api/register',
    [ 
        body('email', 'Ingresa un correo electrónico válido').isEmail().normalizeEmail(),
        body('nombre').optional().trim().escape(),
        body('promos').isBoolean().toBoolean(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, nombre, promos } = req.body;

        try {
            const checkSql = 'SELECT id FROM registrations WHERE email = ?';
            const [existingUsers] = await pool.query(checkSql, [email]);

            if (existingUsers.length > 0) {
                return res.status(409).json({ success: false, message: 'Este correo electrónico ya está registrado.' });
            }

            const insertSql = 'INSERT INTO registrations (email, full_name, accepts_promos) VALUES (?, ?, ?)';
            const [result] = await pool.query(insertSql, [email, nombre || null, promos]);

            console.log('Usuario registrado, ID:', result.insertId);
            res.status(201).json({ success: true, message: 'Registro exitoso.', data: { id: result.insertId, email: email } });
        } catch (err) {
            console.error('Error al registrar usuario:', err.code, err.message);
             if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: 'Este correo electrónico ya está registrado.' });
            }
            res.status(500).json({ success: false, message: 'Error del servidor al procesar el registro.' });
        }
    }
);


app.post(
    '/api/reservations/lookup',
    [ 
      
        body('numero').optional().notEmpty().withMessage('El número de reserva no puede estar vacío si se proporciona').trim().escape(),
        body('emailReserva').optional().isEmail().withMessage('Ingresa un correo electrónico válido si se proporciona').normalizeEmail(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { numero, emailReserva } = req.body;

        
        if (!numero && !emailReserva) {
             return res.status(400).json({ success: false, message: 'Debes proporcionar el número de reserva o el correo electrónico.' });
        }

       
        let sql = 'SELECT id, reservation_number, first_name, last_name, email, check_in_date, check_out_date, room_type, created_at FROM reservations WHERE ';
        const params = [];
        const conditions = [];

        if (numero) {
            conditions.push('reservation_number = ?');
            params.push(numero);
        }
        if (emailReserva) {
            conditions.push('email = ?');
            params.push(emailReserva);
        }

        
        sql += conditions.join(' OR ');
        
        sql += ' ORDER BY check_in_date DESC';

        console.log('Executing SQL:', sql); 
        console.log('With params:', params); 

        try {
            const [rows] = await pool.query(sql, params);

            if (rows.length > 0) {
               
                const formattedReservations = rows.map(row => ({
                    ...row,
                    check_in_date: new Date(row.check_in_date).toISOString().split('T')[0],
                    check_out_date: new Date(row.check_out_date).toISOString().split('T')[0]
                }));
               
                res.status(200).json({ success: true, data: formattedReservations });
            } else {
                res.status(404).json({ success: false, message: 'No se encontró ninguna reserva con los datos proporcionados.' });
            }
        } catch (err) {
            console.error('Error al buscar reserva:', err.code, err.message);
            res.status(500).json({ success: false, message: 'Error del servidor al buscar la reserva.' });
        }
    }
);



app.post(
    '/api/reservations',
    [ 
        body('nombreReserva', 'El nombre es requerido').notEmpty().trim().escape(),
        body('apellidoReserva', 'El apellido es requerido').notEmpty().trim().escape(),
        body('emailReserva', 'Ingresa un correo electrónico válido').isEmail().normalizeEmail(),
        body('checkInDate', 'La fecha de entrada es requerida y debe ser válida').isISO8601().toDate(),
        body('checkOutDate', 'La fecha de salida es requerida y debe ser válida').isISO8601().toDate()
            .custom((value, { req }) => {
                if (new Date(value) <= new Date(req.body.checkInDate)) {
                    throw new Error('La fecha de salida debe ser posterior a la fecha de entrada.');
                }
                return true;
            }),
        body('roomType', 'El tipo de habitación es requerido').notEmpty().trim().escape(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log("Errores de validación:", errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { nombreReserva, apellidoReserva, emailReserva, checkInDate, checkOutDate, roomType } = req.body;

        
        const reservationNumber = `${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        

        const formattedCheckIn = new Date(checkInDate).toISOString().split('T')[0];
        const formattedCheckOut = new Date(checkOutDate).toISOString().split('T')[0];

        try {
            const sql = 'INSERT INTO reservations (first_name, last_name, email, check_in_date, check_out_date, room_type, reservation_number) VALUES (?, ?, ?, ?, ?, ?, ?)';
            const [result] = await pool.query(sql, [nombreReserva, apellidoReserva, emailReserva, formattedCheckIn, formattedCheckOut, roomType, reservationNumber]);

            console.log('Reserva creada, ID:', result.insertId);
            res.status(201).json({
                success: true,
                message: 'Reserva realizada con éxito.',
                data: {
                    id: result.insertId,
                    reservation_number: reservationNumber,
                    room_type: roomType,
                    check_in_date: formattedCheckIn,
                    check_out_date: formattedCheckOut
                }
            });
        } catch (err) {
            console.error('Error al crear reserva:', err.code, err.message);
            res.status(500).json({ success: false, message: 'Error del servidor al crear la reserva.' });
        }
    }
);


app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('¡Algo salió mal en el servidor!');
});


app.listen(PORT, () => {
    console.log(`Servidor backend (MySQL) escuchando en http://localhost:${PORT}`);
    pool.getConnection()
        .then(connection => {
            console.log('Conectado a la base de datos MySQL (verificación post-inicio).');
            connection.release();
        })
        .catch(err => {
            console.error('ERROR al intentar conectar a la BD MySQL post-inicio:', err.code, err.message);
        });
});