
class SearchLogRouter(object):
    def db_for_read(self, model, **hints):
        if model.__name__ == 'SearchLog':
            return 'lrs'
        return 'default'
    def db_for_write(self, model, **hints):
        return 'default'
    def allow_relation(self, obj1, obj2, **hints):
        return True