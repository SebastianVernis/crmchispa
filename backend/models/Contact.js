const { DataTypes, Op } = require('sequelize');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

module.exports = (sequelize) => {
    const Contact = sequelize.define('Contact', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'El nombre no puede estar vacío.' },
                len: { args: [2, 100], msg: 'El nombre debe tener entre 2 y 100 caracteres.' }
            }
        },
        phone: {
            type: DataTypes.STRING(32),
            allowNull: false,
            unique: { name: 'unique_phone', msg: 'Este número de teléfono ya está registrado.' },
            validate: {
                isPhoneNumber(value) {
                    const phoneNumber = parsePhoneNumberFromString(value, 'MX'); // Asumir MX por defecto, ajustar si es necesario
                    if (!phoneNumber || !phoneNumber.isValid()) {
                        throw new Error('El número de teléfono proporcionado no es válido.');
                    }
                }
            }
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: { name: 'unique_email', msg: 'Este correo electrónico ya está registrado.' },
            validate: {
                isEmail: { msg: 'El formato del correo electrónico no es válido.' }
            }
        },
        status: {
            type: DataTypes.ENUM('New', 'Contacted', 'FollowUp', 'Not Interested', 'Converted'),
            defaultValue: 'New'
        },
        assignedAdvisorId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'Advisors', // Nombre de la tabla tal como se define en Sequelize
                key: 'id'
            }
        },
        qualityScore: {
            type: DataTypes.DECIMAL(5, 2),
            defaultValue: 0,
            validate: { min: 0, max: 100 }
        },
        lastContactDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        contactCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
        // otros campos
    }, {
        timestamps: true,
        tableName: 'Contacts',
        hooks: {
            beforeValidate: (contact) => {
                if (contact.phone) {
                    const phoneNumber = parsePhoneNumberFromString(contact.phone, 'MX'); // Asumir MX por defecto
                    if (phoneNumber && phoneNumber.isValid()) {
                        contact.phone = phoneNumber.format('E.164'); // Normalizar a E.164
                    }
                }
            }
        },
        indexes: [
            { fields: ['assignedAdvisorId', 'status'] },
            { fields: ['phone'], unique: true }, // Ya se maneja con la constraint unique, pero es buena práctica tener el índice
            { fields: ['qualityScore'] },
            { fields: ['email'], unique: true, where: { email: { [Op.ne]: null } } } // Índice único para email no nulos
        ]
    });

    Contact.associate = (models) => {
        Contact.belongsTo(models.Advisor, { foreignKey: 'assignedAdvisorId', as: 'advisor' });
    };

    return Contact;
};
