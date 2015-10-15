var _ = require('lodash'),
  JSONAPISerializer = require('jsonapi-serializer');

// load the lodash inflector mixin
_.mixin(require('lodash-inflection'));

function BookshelfAdapter(data, type, baseUrl, serializerOptions) {

  // Is data a Bookshelf Collection? If no, then it's a Bookshelf Model.
  var isCollection = _isCollection(data);

  // In order to generate the necessary transform schema for the serializer,
  // we only need a single instance of the Bookshelf Model. If data is a Collection
  // pluck the first model to use as a template. Otherwise, just use data as the Model.
  var model = null;

  if (isCollection) {
    model = data.models[0];
  } else {
    model = data;
  }

  // If the data is a Bookshelf Collection, add the top-level links
  // object that describes the Collection's location.
  var options = {};

  if (isCollection) {
    options.topLevelLinks = _buildTopLevelLinks(baseUrl, type);
  }

  // Build the link for each resource.
  options.dataLinks = _buildSelfLink(baseUrl, type, model.get('id'));

  // Get top-level attributes from the Model.
  var topLevelAttributes = _.keys(model.attributes);

  // If the Model has any relations, we need to run through them and build a
  // relationships object to pass to the serializer.
  var relations = {};

  // Include relations in the response unless specified in the options.
  var included = serializerOptions.includeRelations || true;

  _.forOwn(model.relations, function(relationValue, relationType) {

    // Check to see if the Model's relationship is empty. If so,
    // there is no need to process the relation.
    if (!_isRelationshipEmpty(model.relations[relationType])) {

      // Since there is a relation, we need to add the relation key to
      // the top level attributes to form an association.
      topLevelAttributes.push(relationType);

      // Retrieve the attributes/keys from the relation. The keys are
      // used as the transform schema by the serializer.
      var relationAttributes = _getRelationAttributes(relationValue);
      var relationKeys = _.keys(relationAttributes);

      // Build the transform schema for the relation.
      relations[relationType] = _buildRelation(baseUrl, relationType, relationKeys, type, included);
    }

  });

  // Add the attributes to the schema now that relations have been added.
  options.attributes = topLevelAttributes;

  // Add each of the relation transforms to the primary schema.
  _.forOwn(relations, function(value, relation) {
    options[relation] = relations[relation];
  })

  // Add any serializer options to the schema.
  _.assign(options, serializerOptions);

  // Return the data in JSON API format.
  return new JSONAPISerializer(type, data.toJSON(), options);
}

/**
 * Generates the top level links object.
 * @param  {[type]} baseUrl [description]
 * @param  {[type]} type    [description]
 * @return {[type]}         [description]
 */
function _buildTopLevelLinks(baseUrl, type) {
  return _buildSelfLink(baseUrl, type);
}

/**
 * Generates the resource's url.
 * @param  {[type]} baseUrl [description]
 * @param  {[type]} type    [description]
 * @param  {[type]} id      [description]
 * @return {[type]}         [description]
 */
function _buildSelfLink(baseUrl, modelType, id) {
  return {
    self: function (dataSet, model) {

      // base url for the collection
      var link = baseUrl + '/' + _.pluralize(modelType);

      // if an id was specified, append it to the link
      if (model) {
        link += '/' + model.id;
      }

      return link;
    }
  };
}

/**
 * Builds the relationship transform schema.
 * @param  {[type]} baseUrl      [description]
 * @param  {[type]} relationType [description]
 * @param  {[type]} modelType    [description]
 * @param  {[type]} id           [description]
 * @param  {[type]} relationKeys [description]
 * @param  {[type]} included     [description]
 * @return {[type]}              [description]
 */
function _buildRelation(baseUrl, relationType, relationKeys, modelType, included) {

  // pluralize the relation and model types to conform with the spec
  relationType = _.pluralize(relationType);
  modelType = _.pluralize(modelType);

  var baseRelationUrl = baseUrl + '/' + modelType + '/';

  return {
    ref: 'id',
    attributes: relationKeys,
    relationshipLinks: {
      self: function(dataSet, model) {
        return baseRelationUrl + dataSet.id + '/relationships/' + relationType;
      },
      related: function(dataSet, model) {
        return baseRelationUrl + dataSet.id + '/' + relationType;
      }
    },
    includedLinks: {
      self: function(dataSet, model) {
        return baseUrl + '/' + relationType + '/' + model.id;
      }
    },
    included: included
  }
}

/**
 * Retrieves a relation's attributes depending on the
 * type of relationship (one, many).
 * @param  {[type]} relation [description]
 * @return {[type]}          [description]
 */
function _getRelationAttributes(relation) {
  if (relation.models !== undefined &&
    relation.models.length > 0) {

  // treat as many
  return relation.models[0].attributes;

} else if (relation.attributes !== undefined) {

  // treat as one
  return relation.attributes;

}
}

/**
 * Determine whether Bookshelf object is a Collection.
 * @param  {[type]}  data [description]
 * @return {Boolean}      [description]
 */
function _isCollection(data) {
  if (data.models !== undefined) {
    return true;
  } else {
    return false
  }
}

/**
 * Determines whether a Bookshelf Model's relationships are empty.
 * @param  {[type]}  relation [description]
 * @return {Boolean}          [description]
 */
function _isRelationshipEmpty(data) {
  if (data.attributes !== undefined ||
    (data.models !== undefined && data.length > 0)) {
  return false;
}
return true;
}

module.exports = BookshelfAdapter;