const appRoot = require('app-root-path');

const studentsDAO = require('../../../db/oracledb/students-dao');

const { errorHandler } = appRoot.require('errors/errors');
const { openapi: { paths } } = appRoot.require('utils/load-openapi');

const get = async (req, res) => {
  try {
    const { osuId } = req.params;
    const result = await studentsDAO.getGpaById(osuId);
    res.send(result);
  } catch (err) {
    errorHandler(res, err);
  }
};

get.apiDoc = paths['/students/{osuId}/gpa'].get;

module.exports = { get };