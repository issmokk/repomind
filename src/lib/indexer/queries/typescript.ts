export const tsSymbolQuery = `
(function_declaration
  name: (identifier) @function.name
) @function.definition

(lexical_declaration
  (variable_declarator
    name: (identifier) @arrow.name
    value: (arrow_function)
  )
) @arrow.definition

(class_declaration
  name: [(identifier) (type_identifier)] @class.name
) @class.definition

(method_definition
  name: [(property_identifier) (identifier)] @method.name
) @method.definition

(interface_declaration
  name: (type_identifier) @interface.name
) @interface.definition

(type_alias_declaration
  name: (type_identifier) @type_alias.name
) @type_alias.definition

(module
  name: (identifier) @namespace.name
) @namespace.definition
`

export const tsImportQuery = `
(import_statement
  source: (string (string_fragment) @import.source)
) @import.statement

(export_statement
  source: (string (string_fragment) @reexport.source)
) @reexport.statement

(call_expression
  function: (import)
  arguments: (arguments
    (string (string_fragment) @dynamic_import.source)
  )
) @dynamic_import.call
`

export const tsInheritanceQuery = `
(class_declaration
  name: [(identifier) (type_identifier)] @child.name
  (class_heritage
    (extends_clause
      value: [(identifier) (type_identifier)] @extends.parent
    )
  )
) @extends.class

(class_declaration
  name: [(identifier) (type_identifier)] @child.name
  (class_heritage
    (implements_clause
      [(identifier) (type_identifier)] @implements.parent
    )
  )
) @implements.class
`

export const tsCallQuery = `
(call_expression
  function: (identifier) @call.function
) @call.simple

(call_expression
  function: (member_expression
    object: (_) @call.receiver
    property: (property_identifier) @call.method
  )
) @call.member
`
