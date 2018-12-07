const appRoot = require('app-root-path');
const _ = require('lodash');

const contrib = appRoot.require('api/v1/db/oracledb/contrib/contrib');
const { getConnection } = appRoot.require('api/v1/db/oracledb/connection');
const { SerializedGPAs } = require('../../serializers/students-serializer');

/**
 * @summary Return a specific pet by unique ID
 * @function
 * @param {string} osuID OSU ID
 * @returns {Promise} Promise object represents a specific pet
 */
const getGPAsById = osuID => new Promise(async (resolve, reject) => {
  const connection = await getConnection();
  try {
    const { rows } = await connection.execute(contrib.getGPALevelsByID(), [osuID]);
    if (_.isEmpty(rows)) {
      resolve(undefined);
    } else {
      const serializedGPAs = SerializedGPAs(rows, osuID);
      resolve(serializedGPAs);
    }
  } catch (err) {
    reject(err);
  } finally {
    connection.close();
  }
});

module.exports = { getGPAsById };
