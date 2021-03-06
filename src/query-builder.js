/* eslint global-require:0 */
import {tableNameForJoin} from './utils';
import Attributes from './attributes';

const {AttributeCollection, AttributeJoinedData} = Attributes;

/**
The factory methods in this class assemble SQL queries that build Model
tables based on their attribute schema.

@private
*/
export function analyzeQueriesForClass(klass) {
  const queries = [];

  const attributes = Object.keys(klass.attributes).map(k => klass.attributes[k]);
  const collectionAttributes = attributes.filter((attr) =>
    attr.queryable && attr instanceof AttributeCollection
  )

  queries.push(`ANALYZE \`${klass.name}\``);
  collectionAttributes.forEach((attribute) => {
    queries.push(`ANALYZE \`${tableNameForJoin(klass, attribute.itemClass)}\``)
  });

  return queries;
}

export function setupQueriesForClass(klass) {
  const attributes = Object.keys(klass.attributes).map(k => klass.attributes[k]);
  let queries = [];

  // Identify attributes of this class that can be matched against. These
  // attributes need their own columns in the table
  const columnAttributes = attributes.filter(attr =>
    attr.queryable && attr.columnSQL && attr.jsonKey !== 'id'
  );

  const columns = ['id TEXT PRIMARY KEY', 'data BLOB']
  columnAttributes.forEach(attr => columns.push(attr.columnSQL()));

  const columnsSQL = columns.join(',');
  queries.unshift(`CREATE TABLE IF NOT EXISTS \`${klass.name}\` (${columnsSQL})`);
  queries.push(`CREATE UNIQUE INDEX IF NOT EXISTS \`${klass.name}_id\` ON \`${klass.name}\` (\`id\`)`);

  // Identify collection attributes that can be matched against. These require
  // JOIN tables. (Right now the only one of these is Thread.folders or
  // Thread.categories)
  const collectionAttributes = attributes.filter(attr =>
    attr.queryable && attr instanceof AttributeCollection
  );
  collectionAttributes.forEach((attribute) => {
    const joinTable = tableNameForJoin(klass, attribute.itemClass);
    const joinColumns = attribute.joinQueryableBy.map((name) =>
      klass.attributes[name].columnSQL()
    );
    joinColumns.unshift('id TEXT KEY', '`value` TEXT');

    queries.push(`CREATE TABLE IF NOT EXISTS \`${joinTable}\` (${joinColumns.join(',')})`);
    queries.push(`CREATE INDEX IF NOT EXISTS \`${joinTable.replace('-', '_')}_id\` ON \`${joinTable}\` (\`id\` ASC)`);
    queries.push(`CREATE UNIQUE INDEX IF NOT EXISTS \`${joinTable.replace('-', '_')}_val_id\` ON \`${joinTable}\` (\`value\` ASC, \`id\` ASC)`);
  });

  const joinedDataAttributes = attributes.filter(attr =>
    attr instanceof AttributeJoinedData
  )

  joinedDataAttributes.forEach((attribute) => {
    queries.push(`CREATE TABLE IF NOT EXISTS \`${attribute.modelTable}\` (id TEXT PRIMARY KEY, \`value\` TEXT)`);
  });

  if (klass.additionalSQLiteConfig && klass.additionalSQLiteConfig.setup) {
    queries = queries.concat(klass.additionalSQLiteConfig.setup());
  }

  return queries;
}
