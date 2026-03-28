export const rubySymbolQuery = `
(class
  name: [(constant) (scope_resolution)] @class.name
) @class.definition

(module
  name: [(constant) (scope_resolution)] @module.name
) @module.definition

(method
  name: (identifier) @method.name
) @method.definition

(singleton_method
  name: (identifier) @singleton_method.name
) @singleton_method.definition
`

export const rubyImportQuery = `
(call
  method: (identifier) @import.method
  arguments: (argument_list
    [(string (string_content) @import.source)
     (constant) @import.source
     (scope_resolution) @import.source]
  )
  (#match? @import.method "^(require|require_relative|include|extend)$")
) @import.call

(call
  method: (identifier) @import.method
  arguments: [(string (string_content) @import.source)
              (constant) @import.source
              (scope_resolution) @import.source]
  (#match? @import.method "^(require|require_relative|include|extend)$")
) @import.call_no_parens
`

export const rubyInheritanceQuery = `
(class
  name: [(constant) (scope_resolution)] @child.name
  superclass: [(constant) (scope_resolution)] @parent.name
) @inheritance.class
`

export const rubyCallQuery = `
(call
  receiver: (_) @call.receiver
  method: (identifier) @call.method
) @call.with_receiver

(call
  method: (identifier) @call.method
  (#not-match? @call.method "^(require|require_relative|include|extend|puts|p|pp|raise)$")
) @call.standalone
`
