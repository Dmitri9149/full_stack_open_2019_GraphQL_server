const { ApolloServer, UserInputError, gql } = require('apollo-server')
const uuid = require('uuid/v1')

let authors = [
  {
    name: 'Robert Martin',
    id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
    born: 1952,
  },
  {
    name: 'Martin Fowler',
    id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
    born: 1963
  },
  {
    name: 'Fyodor Dostoevsky',
    id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
    born: 1821
  },
  { 
    name: 'Joshua Kerievsky', // birthyear not known
    id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
  },
  { 
    name: 'Sandi Metz', // birthyear not known
    id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
  },
]

/*
 * It would be more sensible to assosiate book and the author by saving 
 * the author id instead of the name to the book.
 * For simplicity we however save the author name.
*/

let books = [
  {
    title: 'Clean Code',
    published: 2008,
    author: 'Robert Martin',
    id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring']
  },
  {
    title: 'Agile software development',
    published: 2002,
    author: 'Robert Martin',
    id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
    genres: ['agile', 'patterns', 'design']
  },
  {
    title: 'Refactoring, edition 2',
    published: 2018,
    author: 'Martin Fowler',
    id: "afa5de00-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring']
  },
  {
    title: 'Refactoring to patterns',
    published: 2008,
    author: 'Joshua Kerievsky',
    id: "afa5de01-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring', 'patterns']
  },  
  {
    title: 'Practical Object-Oriented Design, An Agile Primer Using Ruby',
    published: 2012,
    author: 'Sandi Metz',
    id: "afa5de02-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring', 'design']
  },
  {
    title: 'Crime and punishment',
    published: 1866,
    author: 'Fyodor Dostoevsky',
    id: "afa5de03-344d-11e9-a414-719c6709cf3e",
    genres: ['classic', 'crime']
  },
  {
    title: 'The Demon',
    published: 1872,
    author: 'Fyodor Dostoevsky',
    id: "afa5de04-344d-11e9-a414-719c6709cf3e",
    genres: ['classic', 'revolution']
  },
]

const typeDefs = gql`
  type Query {
    hello: String!
    bookCount:Int!
    authorCount:Int!
    allBooks(author:String, genre:String):[Book!]!
    allAuthors:[Author!]!
  }


  type Book {
    title:String!
    published:Int!
    author:String!
    genres:[String!]!
    id:ID!

  }
  type Author {
      name:String!
      born:Int
      bookCount:Int!
      id:ID!
  }

  type Mutation {
    addBook(
      title:String!
      author:String!
      published:Int!
      genres:[String!]!
    ):Book
  }
 `

const resolvers = {
  Query: {
    hello: () => { return "world" },
    bookCount:() => {return books.length },
    authorCount:()=> {return authors.length},
    allBooks:(root, args) => {
        if (!args.author&&!args.genre) {
            return books
        } else if (args.author&&!args.genre) {
            return books.filter( book=> book.author === args.author)
        } else if (!args.author&&args.genre) {
            return books.filter(book=> book.genres.find(genre => genre === args.genre))
        } else {
            const authorBooks = books.filter(book => book.author === args.author)
            return authorBooks.filter(book=> book.genres.find(genre => genre === args.genre))
        }
    },
    allAuthors:()=> authors.map(a =>
        {
            const bookCount = (name) => books.map(book=> book.author).filter(a=>a===name).length
             return {...a, bookCount:bookCount(a.name)}
        }),
  },
  Mutation: {
    addBook:(root, args)=> {
      if (books.find(b=> b.title === args.title)) {
        throw new UserInputError ('Title must be unique!', {
          invalidArgs:args.title })
      }

      const book = {...args, id:uuid()}
      books = books.concat(book)

      if (!authors.find(a=> a.name === args.author)) {
        const author = {name:args.author, born:null, id:uuid()}
        authors = authors.concat(author)
      }

      return book
    }
  } 
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})