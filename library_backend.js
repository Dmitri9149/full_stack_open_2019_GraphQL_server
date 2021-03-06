const { ApolloServer, UserInputError, gql, AuthenticationError } = require('apollo-server')
const uuid = require('uuid/v1')
const config = require('./utils/config')

const mongoose = require('mongoose')
const Book = require('./models/book')
const Author = require('./models/author')
const User = require('./models/user')

const jwt = require('jsonwebtoken')

const { PubSub } = require('apollo-server')
const pubsub = new PubSub()


mongoose.set('useFindAndModify', false)

console.log('connecting to:', config.MONGODB_URI)
console.log('secret in use:', config.JWT_SECRET)

mongoose.connect(config.MONGODB_URI, { useNewUrlParser: true })
  .then(() => {
    console.log("Connected to DB")
  })
  .catch((error) => {
    console.log('error connection to MongoDB:', error.message)
  })

const JWT_SECRET = config.JWT_SECRET

console.log('JWT_SECRET: ', JWT_SECRET)



const typeDefs = gql`
  type Query {
    hello: String!
    bookCount:Int!
    authorCount:Int!
    allBooks(author:String, genre:String):[Book!]!
    allAuthors:[Author!]!
    me: User
  }

  type Book {
    title: String!
    published: Int!
    author: Author!
    genres: [String!]!
    id: ID!
  }

  type Author {
      name:String!
      born:Int
      bookCount:Int
      id:ID!
  }

  type Mutation {
    addBook(
      title:String!
      author:String!
      published:Int!
      genres:[String!]!
    ):Book

    editAuthor(
      name:String!
      setBornTo:Int!
    ):Author

    createUser(
      username: String!
      favoriteGenre: String!
    ): User

    login(
      username: String!
      password: String!
    ): Token

  }

  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }
  
  type Token {
    value: String!
  }

  type Subscription {
    bookAdded: Book!
  }  
  
 `

const resolvers = {
  Query: {
    hello: () => { return "world" },
    bookCount:() => Author.collections.countDocuments(),
    authorCount:()=> Book.collections.countDocuments(),
    allBooks: async (root, args) => {
      return await Book.find({}).populate('author')  
    },
    allAuthors:() => {
      return Author.find({})
    },

// 8.21 ex , possible implementation at backend
//***********
//    allBooks:(root, args) => {
//      if (!args.author&&!args.genre) {
//          return books
//      } else if (args.author&&!args.genre) {
//          return books.filter( book=> book.author === args.author)
//      } else if (!args.author&&args.genre) {
//          return books.filter(book=> book.genres.find(genre => genre === args.genre))
//      } else {
//          const authorBooks = books.filter(book => book.author === args.author)
//          return authorBooks.filter(book=> book.genres.find(genre => genre === args.genre))
//      }
//  },
    me: (root, args, context) => {
      return context.currentUser
    }
  },

  Mutation: {
    addBook: async (root, args,context)=> {
      const currentUser = context.currentUser

      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      const tryAuthor = await Author.findOne({name:args.author})
      console.log('try author ', tryAuthor)

      if (typeof tryAuthor === 'undefined'|| tryAuthor === null) {
        console.log('name:', args.author)
        const author = new Author({name:args.author})
        console.log('New Author', author)

        try {
          await author.save()
        } catch (error) {
          throw new UserInputError(eror.message, {
            invalidArgs:args
          })
        }
      }
      const existAuthor = await Author.findOne({name:args.author})
      const book = new Book({...args, author:existAuthor})

      try {
        await book.save()
      } catch (error) {
        throw new UserInputError(eror.message, {
          invalidArgs:args
        })
      }
      pubsub.publish('BOOK_ADDED', { bookAdded: book })
      return book
    },
    editAuthor:async (root, args, context)=> {
      const currentUser = context.currentUser

      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      const author = await Author.findOne({name:args.name})
      author.born = args.setBornTo

      if (!author) {return null}

      try {
        await author.save()
      } catch (error) {
        throw new UserInputError(eror.message, {
          invalidArgs:args
        })
      }

      return author

    },
    createUser: (root, args) => {
      const user = new User({ username: args.username, favoriteGenre: args.favoriteGenre })
  
      return user.save()
        .catch(error => {
          throw new UserInputError(error.message, {
            invalidArgs: args,
          })
        })
    },

    login: async (root, args) => {
      const user = await User.findOne({ username: args.username })
  
      if ( !user || args.password !== 'secred' ) {
        console.log('User:', user)
        console.log('Password:', args.password)
        throw new UserInputError("wrong credentials")
      }
  
      const userForToken = {
        username: user.username,
        id: user._id,
      }
  
      return { value: jwt.sign(userForToken, JWT_SECRET) }
    },
  },
  Author: {
    bookCount: (root)=> Book.countDocuments({author:root})
  },

  Subscription: {
    bookAdded: {
      subscribe: () => {
        console.log("In subcsription resolver")
        return pubsub.asyncIterator(['BOOK_ADDED'])
      }
    },
  },

  
} 

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const auth = req ? req.headers.authorization : null
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const decodedToken = jwt.verify(
        auth.substring(7), JWT_SECRET
      )
      const currentUser = await User.findById(decodedToken.id)
      return { currentUser }
    }
  }
})

server.listen().then(({ url, subscriptionsUrl }) => {
  console.log(`Server ready at ${url}`)
  console.log(`Subscriptions ready at ${subscriptionsUrl}`)
})