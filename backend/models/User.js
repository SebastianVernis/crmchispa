const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

module.exports = (sequelize) => {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        username: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            validate: { len: [3, 50] }
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isStrongPassword(value) {
                    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value)) {
                        throw new Error('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.');
                    }
                }
            }
        },
        role: {
            type: DataTypes.ENUM('admin', 'asesor', 'superadmin'),
            defaultValue: 'asesor'
        },
        advisorId: { // Enlace opcional a un perfil de asesor
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: true,
            references: { model: 'Advisors', key: 'id' }
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        lastLogin: {
            type: DataTypes.DATE,
            allowNull: true
        }
        // otros campos de seguridad
    }, {
        timestamps: true,
        tableName: 'Users',
        hooks: {
            beforeValidate: (user) => {
                if (user.username) user.username = user.username.toLowerCase();
            },
            beforeCreate: async (user) => {
                user.password = await bcrypt.hash(user.password, saltRounds);
            },
            beforeUpdate: async (user) => {
                if (user.changed('password')) {
                    user.password = await bcrypt.hash(user.password, saltRounds);
                }
            }
        }
    });

    User.associate = (models) => {
        User.belongsTo(models.Advisor, { foreignKey: 'advisorId', as: 'advisorProfile' });
    };

    User.prototype.checkPassword = async function (password) {
        return bcrypt.compare(password, this.password);
    };

    // Class method to find user by username (ajustado para incluir el perfil del asesor si existe)
    User.findByUsername = async function(username) {
        return await this.findOne({
            where: { username: username.toLowerCase(), isActive: true },
            include: [{ model: sequelize.models.Advisor, as: 'advisorProfile', required: false }]
        });
    };

    return User;
};
